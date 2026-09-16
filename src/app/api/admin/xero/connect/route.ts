/**
 * GET /api/admin/xero/connect
 *
 * Starts the one-time Xero OAuth flow. On approval Xero redirects back to
 * /api/admin/xero/callback with an authorization code, exchanged for tokens
 * there — the admin never sees or handles a raw token.
 */
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { assertAdmin } from '@/lib/admin/guard';

const REDIRECT_URI = 'https://www.flowen.digital/api/admin/xero/callback';
const SCOPES = [
  'openid', 'profile', 'email',
  'accounting.transactions', 'accounting.contacts', 'accounting.settings.read',
  'offline_access',
].join(' ');

export async function GET(): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
  return res;
}
