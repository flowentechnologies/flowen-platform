import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const MAX_RECIPIENTS = 500;
const FROM = '"Flowen" <flowenspeech@outlook.com>';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function transport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_SERVER_HOST     ?? 'smtp.outlook.com',
    port:   parseInt(process.env.EMAIL_SERVER_PORT ?? '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_SERVER_USER     ?? 'flowenspeech@outlook.com',
      pass: process.env.EMAIL_SERVER_PASSWORD ?? '',
    },
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHtml(subject: string, body: string): string {
  const paragraphs = body
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `<p style="margin:12px 0;font-size:15px;color:#94a3b8;line-height:1.65;">${escHtml(l)}</p>`)
    .join('\n');
  const safeSubject = escHtml(subject);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;max-width:100%;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #334155;">
            <a href="${SITE}" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
              <span style="width:28px;height:28px;background:#10b981;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#0f172a;font-size:14px;">F</span>
              <span style="font-weight:700;font-size:16px;color:#f8fafc;letter-spacing:-0.3px;">Flowen</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">${safeSubject}</h1>
            ${paragraphs}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #334155;background:#0f172a;">
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
              Flowen &bull; Questions? <a href="mailto:flowenspeech@outlook.com" style="color:#10b981;">flowenspeech@outlook.com</a>
              &bull; <a href="${SITE}/legal" style="color:#10b981;">Unsubscribe / Privacy</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Segment resolvers ─────────────────────────────────────────────────────────

type Segment = 'waitlist' | 'all_users' | 'founding' | 'active_subscribers';

async function resolveEmails(segment: Segment): Promise<string[]> {
  const db = adminDb();

  if (segment === 'waitlist') {
    const { data } = await db.from('waitlist_signups').select('email').limit(MAX_RECIPIENTS);
    return (data ?? []).map((r: { email: string }) => r.email);
  }

  // For user-based segments, join auth.users with profiles via service role
  const [authRes, profileRes] = await Promise.all([
    db.schema('auth').from('users').select('id,email').limit(MAX_RECIPIENTS),
    segment === 'all_users'
      ? Promise.resolve({ data: null })
      : segment === 'founding'
      ? db.from('profiles').select('id').eq('tier', 'founding').limit(MAX_RECIPIENTS)
      : db.from('subscriptions').select('user_id').eq('status', 'active').limit(MAX_RECIPIENTS),
  ]);

  const authUsers = (authRes.data ?? []) as { id: string; email: string }[];

  if (segment === 'all_users') {
    return authUsers.map(u => u.email).filter(Boolean);
  }

  const profileData = (profileRes.data ?? []) as { id?: string; user_id?: string }[];
  const allowedIds  = new Set(profileData.map(p => p.id ?? p.user_id));
  return authUsers.filter(u => allowedIds.has(u.id)).map(u => u.email).filter(Boolean);
}

// ── GET — segment counts ──────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = adminDb();
  const [waitlistRes, usersRes, foundingRes, activeSubsRes] = await Promise.all([
    db.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'founding'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  return NextResponse.json({
    counts: {
      waitlist:           waitlistRes.count   ?? 0,
      all_users:          usersRes.count       ?? 0,
      founding:           foundingRes.count    ?? 0,
      active_subscribers: activeSubsRes.count  ?? 0,
    },
  });
}

// ── POST — send broadcast ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { segment: Segment; subject: string; body: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { segment, subject, body: text } = body;
  if (!segment || !subject?.trim() || !text?.trim()) {
    return NextResponse.json({ error: 'segment, subject, and body are required' }, { status: 400 });
  }

  const emails = await resolveEmails(segment);
  if (emails.length === 0) {
    return NextResponse.json({ error: 'No recipients found for this segment' }, { status: 400 });
  }

  const html = buildHtml(subject, text);
  const mailer = transport();

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const email of emails.slice(0, MAX_RECIPIENTS)) {
    try {
      await mailer.sendMail({ from: FROM, to: email, subject, text, html });
      sent++;
    } catch (err) {
      failed++;
      if (errors.length < 5) errors.push(`${email}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return NextResponse.json({ sent, failed, errors, total: emails.length });
}
