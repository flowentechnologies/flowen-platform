/**
 * GET /api/admin/gmail/callback
 *
 * Completes the OAuth flow started by /connect: exchanges the authorization
 * code for an access + refresh token, stores them in gmail_oauth_tokens, and
 * ensures every @flowen.digital alias exists as a Gmail "send as" identity
 * (idempotent — safe if some already exist from a prior connection). The
 * daily /api/cron/gmail-token-refresh job keeps the access token alive after
 * this — nothing further is needed from the admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { ensureSendAsAliases } from '@/lib/gmail';

const REDIRECT_URI = 'https://www.flowen.digital/api/admin/gmail/callback';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expectedState = req.cookies.get('gmail_oauth_state')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: 'Invalid OAuth state or missing code' }, { status: 400 });
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Gmail app credentials not configured' }, { status: 500 });
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokenBody = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenBody.access_token) {
    return NextResponse.json({ error: tokenBody.error_description ?? 'Token exchange failed' }, { status: 500 });
  }

  const expiresAt = tokenBody.expires_in
    ? new Date(Date.now() + tokenBody.expires_in * 1000).toISOString()
    : null;

  await db().from('gmail_oauth_tokens').upsert({
    id: 'admin',
    mailbox: 'admin@flowen.digital',
    access_token: tokenBody.access_token,
    refresh_token: tokenBody.refresh_token ?? null,
    expires_at: expiresAt,
    scope: tokenBody.scope ?? null,
    updated_at: new Date().toISOString(),
  });

  // Best-effort — connection still succeeds even if alias setup has a hiccup;
  // /admin/inbox surfaces which aliases are actually send-as-ready.
  let aliasResult: { created: string[]; skipped: string[] } | null = null;
  try {
    aliasResult = await ensureSendAsAliases();
  } catch (err) {
    console.error('[gmail] send-as alias setup failed:', err);
  }

  const redirectUrl = new URL('/admin/inbox', req.url);
  redirectUrl.searchParams.set('gmail', 'connected');
  if (aliasResult) redirectUrl.searchParams.set('aliases_created', String(aliasResult.created.length));

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.delete('gmail_oauth_state');
  return res;
}
