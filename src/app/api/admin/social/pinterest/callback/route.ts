/**
 * GET /api/admin/social/pinterest/callback
 *
 * Completes the OAuth flow started by /connect: exchanges the authorization
 * code for an access + refresh token, picks a board to publish to (prefers
 * one named "Flowen", else the first board on the account), and stores
 * everything in social_platform_tokens. The daily
 * /api/cron/pinterest-token-refresh job keeps the access token alive after
 * this — nothing further is needed from the admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const REDIRECT_URI = 'https://flowen.digital/api/admin/social/pinterest/callback';
const API_BASE = 'https://api.pinterest.com/v5';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expectedState = req.cookies.get('pinterest_oauth_state')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: 'Invalid OAuth state or missing code' }, { status: 400 });
  }

  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Pinterest app credentials not configured' }, { status: 500 });
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const tokenBody = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    message?: string;
  };

  if (!tokenRes.ok || !tokenBody.access_token) {
    return NextResponse.json({ error: tokenBody.message ?? 'Token exchange failed' }, { status: 500 });
  }

  // Board selection is best-effort — the admin can correct board_id later
  // if this guesses wrong (no boards, or none named "Flowen").
  let boardId: string | null = null;
  let boardName = '';
  try {
    const boardsRes = await fetch(`${API_BASE}/boards`, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    const boardsBody = await boardsRes.json() as { items?: Array<{ id: string; name: string }> };
    const boards = boardsBody.items ?? [];
    const preferred = boards.find(b => b.name.toLowerCase().includes('flowen')) ?? boards[0];
    if (preferred) {
      boardId = preferred.id;
      boardName = preferred.name;
    }
  } catch {
    // Board lookup is best-effort; connection still succeeds without one.
  }

  const expiresAt = tokenBody.expires_in
    ? new Date(Date.now() + tokenBody.expires_in * 1000).toISOString()
    : null;

  await db().from('social_platform_tokens').upsert({
    platform: 'pinterest',
    access_token: tokenBody.access_token,
    refresh_token: tokenBody.refresh_token ?? null,
    expires_at: expiresAt,
    board_id: boardId,
    updated_at: new Date().toISOString(),
  });

  const redirectUrl = new URL('/admin/social', req.url);
  redirectUrl.searchParams.set('pinterest', boardId ? 'connected' : 'connected_no_board');
  if (boardName) redirectUrl.searchParams.set('board', boardName);

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.delete('pinterest_oauth_state');
  return res;
}
