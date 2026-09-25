/**
 * GET /api/admin/xero/connect?entity=group|ip|speech-technologies|labs
 *
 * Starts the Xero OAuth flow for one Flowen group entity — each of the 4
 * companies (src/lib/flowen-entities.ts) connects separately, since each is
 * its own Xero organisation. On approval Xero redirects back to
 * /api/admin/xero/callback with an authorization code, exchanged for tokens
 * there — the admin never sees or handles a raw token. `entity` rides in the
 * state cookie (signed by nothing, but scoped httpOnly + short-lived like the
 * CSRF state token next to it) so the callback knows which row to upsert.
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { assertAdmin } from '@/lib/admin/guard';
import { isXeroEntitySlug } from '@/lib/flowen-entities';

const REDIRECT_URI = 'https://www.flowen.digital/api/admin/xero/callback';
// Xero replaced the old broad 'accounting.transactions' scope with granular
// ones for every app created on or after 2 March 2026 (confirmed live via
// Xero's own developer docs, not training data — a brand-new app can never
// be granted the broad scope at all, which is what actually threw the
// invalid_scope error at /connect). accounting.contacts and
// accounting.settings.read are unaffected by that split and keep their
// existing names.
const SCOPES = [
  'openid', 'profile', 'email',
  'accounting.invoices',        // create/read invoices (stripe_sync, expense_from_email)
  'accounting.payments',        // create/read payments (stripe_sync)
  'accounting.banktransactions', // list/categorise bank transactions (categorize)
  'accounting.manualjournals',  // create manual journals (dla_journal) — its own
                                 // granular scope, confirmed against Xero's docs;
                                 // distinct from accounting.journals.read, which
                                 // covers the unrelated, Advanced-tier-gated
                                 // system Journals report endpoint we don't use.
  'accounting.reports.profitandloss.read', // real P&L (Group Overview) — the broad
  'accounting.reports.balancesheet.read',  // 'accounting.reports.read' was split
                                 // into per-report granular scopes; these two are
                                 // confirmed NOT behind the Advanced-tier paywall
                                 // (that gate is specifically the raw Journals
                                 // ledger endpoint, XPM, and Bulk Connections —
                                 // verified independently, not assumed).
  'accounting.contacts',
  'accounting.settings.read',   // chart of accounts (categorize)
  'offline_access',
].join(' ');

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const entity = new URL(req.url).searchParams.get('entity');
  if (!entity || !isXeroEntitySlug(entity)) {
    return NextResponse.json({ error: 'entity query param is required (group, ip, speech-technologies, or labs)' }, { status: 400 });
  }

  const clientId = process.env.XERO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'XERO_CLIENT_ID not configured' }, { status: 500 });
  }

  const state = randomBytes(16).toString('hex');
  const authorizeUrl = new URL('https://login.xero.com/identity/connect/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', SCOPES);
  authorizeUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set('xero_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  res.cookies.set('xero_oauth_entity', entity, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
