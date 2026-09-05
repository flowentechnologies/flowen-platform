/**
 * GET /api/admin/gmail/connect
 *
 * Starts the one-time Gmail OAuth flow for the single admin@ mailbox that
 * every @flowen.digital alias already routes into. On approval Google
 * redirects back to /api/admin/gmail/callback with an authorization code,
 * exchanged for tokens there — the admin never sees or handles a raw token.
 */
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { assertAdmin } from '@/lib/admin/guard';

const REDIRECT_URI = 'https://www.flowen.digital/api/admin/gmail/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
].join(' ');

export async function GET(): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GMAIL_CLIENT_ID not configured' }, { status: 500 });
  }

  const state = randomBytes(16).toString('hex');
  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', SCOPES);
  authorizeUrl.searchParams.set('access_type', 'offline'); // ensures a refresh_token is issued
  authorizeUrl.searchParams.set('prompt', 'consent');       // forces refresh_token even on re-auth
  authorizeUrl.searchParams.set('login_hint', 'admin@flowen.digital');
  authorizeUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
