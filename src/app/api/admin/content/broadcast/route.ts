import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, FROM, buildBroadcastHtml } from '@/lib/email';

const MAX_RECIPIENTS = 500;

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Segment resolvers ─────────────────────────────────────────────────────────

type Segment = 'waitlist' | 'all_users' | 'founding' | 'active_subscribers';

async function resolveEmails(segment: Segment): Promise<string[]> {
  const db = adminDb();

  if (segment === 'waitlist') {
    const { data } = await db.from('waitlist_signups').select('email').limit(MAX_RECIPIENTS);
    return (data ?? []).map((r: { email: string }) => r.email);
  }

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
      waitlist:           waitlistRes.count  ?? 0,
      all_users:          usersRes.count     ?? 0,
      founding:           foundingRes.count  ?? 0,
      active_subscribers: activeSubsRes.count ?? 0,
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

  const html = buildBroadcastHtml(subject, text);
  const BATCH = 20;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const batch = emails.slice(0, MAX_RECIPIENTS);
  for (let i = 0; i < batch.length; i += BATCH) {
    const chunk = batch.slice(i, i + BATCH);
    for (const email of chunk) {
      const ok = await sendEmail({ from: FROM.updates, to: email, subject, text, html });
      if (ok) { sent++; } else {
        failed++;
        if (errors.length < 5) errors.push(email);
      }
    }
  }

  return NextResponse.json({ sent, failed, errors, total: emails.length });
}
