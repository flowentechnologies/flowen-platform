/**
 * GET /api/admin/social/pinterest/connect
 *
 * Starts the one-time Pinterest OAuth flow: redirects the admin to
 * Pinterest's consent screen. On approval Pinterest redirects back to
 * /api/admin/social/pinterest/callback with an authorization code, which is
 * exchanged for tokens there — the admin never sees or handles a raw token.
 */
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { assertAdmin } from '@/lib/admin/guard';

const REDIRECT_URI = 'https://flowen.digital/api/admin/social/pinterest/callback';
const SCOPES = 'boards:read,boards:write,pins:read,pins:write';

export async function GET(): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clientId = process.env.PINTEREST_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'PINTEREST_CLIENT_ID not configured' }, { status: 500 });
  }

  const state = randomBytes(16).toString('hex');
  const authorizeUrl = new URL('https://www.pinterest.com/oauth/');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', SCOPES);
  authorizeUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authorizeUrl.toString());
  res.cookies.set('pinterest_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return res;
}
