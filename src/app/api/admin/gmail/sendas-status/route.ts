/**
 * GET /api/admin/gmail/sendas-status
 *
 * Diagnostic + self-heal for the "replies still send as admin@, not the
 * alias" symptom: fetches Gmail's actual send-as identities (including
 * verificationStatus, which Gmail silently falls back to the primary
 * address for if not "accepted" — the most likely root cause), and
 * re-attempts ensureSendAsAliases() in case any are missing entirely.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { ensureSendAsAliases, ALIASES, aliasEmail, getValidAccessToken } from '@/lib/gmail';

interface SendAsIdentity {
  sendAsEmail: string;
  displayName?: string;
  isPrimary?: boolean;
  isDefault?: boolean;
  treatAsAlias?: boolean;
  verificationStatus?: string;
  isVerified?: boolean; // legacy/alt field some API versions return
}

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  // Re-attempt creation first — cheap and idempotent, covers the "never
  // successfully created at connect-time" case.
  let repair: { created: string[]; skipped: string[]; errors: Record<string, unknown> } | null = null;
  try {
    repair = await ensureSendAsAliases();
  } catch (err) {
    return NextResponse.json({ error: `ensureSendAsAliases failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json() as { sendAs?: SendAsIdentity[]; error?: unknown };
  if (!res.ok) return NextResponse.json({ error: 'Gmail sendAs list failed', detail: body.error }, { status: 500 });

  const identities = body.sendAs ?? [];
  const expected = ALIASES.map(a => aliasEmail(a));
  const report = expected.map(email => {
    const found = identities.find(i => i.sendAsEmail === email);
    return {
      email,
      exists: !!found,
      verified: found ? (found.verificationStatus === 'accepted' || found.isVerified === true) : false,
      verificationStatus: found?.verificationStatus ?? null,
      treatAsAlias: found?.treatAsAlias ?? null,
    };
  });

  const notVerified = report.filter(r => r.exists && !r.verified);
  const missing = report.filter(r => !r.exists);

  return NextResponse.json({
    repair,
    identities: report,
    summary: {
      total_expected: expected.length,
      verified_and_ready: report.filter(r => r.verified).length,
      exists_but_unverified: notVerified.map(r => r.email),
      missing_entirely: missing.map(r => r.email),
    },
    raw_gmail_response: identities,
  });
}
