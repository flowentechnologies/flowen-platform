/**
 * /api/cron/pinterest-token-refresh
 *
 * Refreshes the Pinterest access token daily — well within its 30-day
 * expiry and the refresh token's rolling 60-day window. Pinterest rotates
 * the refresh token on every use, so the new one is persisted each run;
 * running daily means a single missed run is never a real risk.
 *
 * No-ops with a 200 if Pinterest hasn't been connected yet (see
 * /api/admin/social/pinterest/connect) — same graceful-skip pattern used
 * across every other integration in this app.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';

const API_BASE = 'https://api.pinterest.com/v5';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = db();
  const { data: row } = await client
    .from('social_platform_tokens')
    .select('refresh_token')
    .eq('platform', 'pinterest')
    .maybeSingle();

  if (!row?.refresh_token) {
    return NextResponse.json({ ok: true, skipped: 'pinterest not connected' });
  }

  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, error: 'Pinterest app credentials not configured' }, { status: 500 });
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }),
  });

  const body = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    message?: string;
  };

  if (!res.ok || !body.access_token) {
    return NextResponse.json({ ok: false, error: body.message ?? 'Refresh failed' }, { status: 500 });
  }

  const expiresAt = body.expires_in
    ? new Date(Date.now() + body.expires_in * 1000).toISOString()
    : null;

  await client.from('social_platform_tokens').update({
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? row.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq('platform', 'pinterest');

  return NextResponse.json({ ok: true });
}
