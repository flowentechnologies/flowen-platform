import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WaitlistSignup {
  id: string;
  email: string;
  source: string;
  created_at: string;
  invited_at: string | null;
  invite_expires_at: string | null;
  converted_at: string | null;
  status: 'not_invited' | 'invited' | 'expired' | 'converted';
}

interface WaitlistRow {
  id: string;
  email: string;
  source: string;
  created_at: string;
  invited_at: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  converted_at: string | null;
}

// ── DB client ─────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Status helper ─────────────────────────────────────────────────────────────

function computeStatus(
  row: Pick<WaitlistRow, 'invited_at' | 'invite_expires_at' | 'converted_at'>,
): WaitlistSignup['status'] {
  if (row.converted_at !== null) return 'converted';
  if (row.invited_at !== null && row.invite_expires_at !== null) {
    if (new Date(row.invite_expires_at) > new Date()) return 'invited';
    return 'expired';
  }
  return 'not_invited';
}

function toSignup(row: WaitlistRow): WaitlistSignup {
  return {
    id: row.id,
    email: row.email,
    source: row.source,
    created_at: row.created_at,
    invited_at: row.invited_at,
    invite_expires_at: row.invite_expires_at,
    converted_at: row.converted_at,
    status: computeStatus(row),
  };
}

// ── Email helper ──────────────────────────────────────────────────────────────

function buildInviteHtml(email: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://flowen.digital';
  const inviteUrl = `${baseUrl}/invite/${token}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0a0d14;color:#e2e8f0;font-family:system-ui,sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;">
    <div style="margin-bottom:32px;">
      <span style="display:inline-block;background:#10b981;color:#000;font-weight:900;font-size:14px;padding:6px 12px;border-radius:8px;letter-spacing:-0.5px;">FLOWEN</span>
    </div>
    <h1 style="font-size:24px;font-weight:800;color:#fff;margin:0 0 12px;">You're in.</h1>
    <p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 32px;">
      Your spot on the Flowen waitlist has been approved. Click below to create your account and start your AI-powered speech practice.
    </p>
    <a href="${inviteUrl}" style="display:inline-block;background:#10b981;color:#000;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">
      Accept invitation &rarr;
    </a>
    <p style="color:#475569;font-size:12px;margin-top:32px;line-height:1.5;">
      This invitation expires in 7 days. If you didn't sign up for Flowen, you can ignore this email.
    </p>
    <p style="color:#475569;font-size:11px;margin-top:8px;">
      Or copy this link: <span style="color:#64748b;">${inviteUrl}</span>
    </p>
  </div>
</body>
</html>`;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await db()
    .from('waitlist_signups')
    .select('id, email, source, created_at, invited_at, invite_token, invite_expires_at, converted_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const signups = ((data ?? []) as WaitlistRow[]).map(toSignup);
  return NextResponse.json({ signups });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: Record<string, unknown> = await request.json();
  const action = body.action as string | undefined;

  // ── invite ─────────────────────────────────────────────────────────────────

  if (action === 'invite') {
    const ids = body.ids as string[] | undefined;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    let sent = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const token = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { data: row, error: fetchError } = await db()
          .from('waitlist_signups')
          .select('email')
          .eq('id', id)
          .single();

        if (fetchError || !row) {
          errors.push(`${id}: not found`);
          continue;
        }

        const email = (row as { email: string }).email;

        const { error: updateError } = await db()
          .from('waitlist_signups')
          .update({
            invite_token: token,
            invited_at: now.toISOString(),
            invite_expires_at: expiresAt.toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          errors.push(`${email}: ${updateError.message}`);
          continue;
        }

        const { error: emailError } = await resend.emails.send({
          from: 'Flowen <hello@flowen.digital>',
          to: email,
          subject: "You're invited to Flowen",
          html: buildInviteHtml(email, token),
        });

        if (emailError) {
          errors.push(`${email}: email failed — ${emailError.message}`);
          continue;
        }

        void logAuditEvent({
          actor_id: admin.id,
          actor_email: admin.email,
          action: 'waitlist.invited',
          resource_type: 'waitlist_signup',
          resource_id: id,
          metadata: { email },
          severity: 'info',
        });

        sent++;
      } catch (err) {
        errors.push(`${id}: unexpected error — ${String(err)}`);
      }
    }

    return NextResponse.json({ sent, errors });
  }

  // ── revoke ─────────────────────────────────────────────────────────────────

  if (action === 'revoke') {
    const id = body.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await db()
      .from('waitlist_signups')
      .update({ invite_token: null, invited_at: null, invite_expires_at: null })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    void logAuditEvent({
      actor_id: admin.id,
      actor_email: admin.email,
      action: 'waitlist.revoked',
      resource_type: 'waitlist_signup',
      resource_id: id,
      severity: 'info',
    });

    return NextResponse.json({ ok: true });
  }

  // ── delete ─────────────────────────────────────────────────────────────────

  if (action === 'delete') {
    const id = body.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await db()
      .from('waitlist_signups')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    void logAuditEvent({
      actor_id: admin.id,
      actor_email: admin.email,
      action: 'waitlist.deleted',
      resource_type: 'waitlist_signup',
      resource_id: id,
      severity: 'info',
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
