/**
 * Pinterest API v5 publishing — genuinely self-serve, unlike Snapchat's
 * allowlist-gated Public Profile API: any developer can register an app and
 * publish Pins on Trial-tier access immediately, with no Pinterest approval
 * needed to post to your own connected account (Standard-tier review only
 * raises rate limits, it doesn't gate whether posting works at all).
 *
 * Unlike Meta's non-expiring Page token, Pinterest access tokens expire
 * every 30 days and roll on a 60-day refresh-token window — refreshed daily
 * by /api/cron/pinterest-token-refresh, comfortably inside both windows.
 * Tokens live in Supabase (social_platform_tokens), not Vercel env vars,
 * since a cron needs to rewrite them in place without a redeploy.
 *
 * One-time setup: an admin visits /api/admin/social/pinterest/connect to
 * run the OAuth authorize flow once. PINTEREST_CLIENT_ID/SECRET (Vercel env
 * vars) are the only static secrets needed.
 */

import { adminDb as db } from '@/lib/supabase/admin';

const API_BASE = 'https://api.pinterest.com/v5';

interface PinterestTokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  board_id: string | null;
}

async function getTokenRow(): Promise<PinterestTokenRow | null> {
  const { data } = await db()
    .from('social_platform_tokens')
    .select('access_token, refresh_token, expires_at, board_id')
    .eq('platform', 'pinterest')
    .maybeSingle();
  return data ?? null;
}

export async function isPinterestConfigured(): Promise<boolean> {
  const row = await getTokenRow();
  return Boolean(row?.access_token && row?.board_id);
}

/** Create a single image Pin on the connected board. */
export async function publishToPinterest(opts: {
  imageUrl: string;
  title: string;
  description: string;
  link?: string;
}): Promise<{ pinId: string }> {
  const row = await getTokenRow();
  if (!row?.access_token || !row?.board_id) {
    throw new Error('Pinterest is not connected (missing access token or board_id)');
  }

  const res = await fetch(`${API_BASE}/pins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${row.access_token}`,
    },
    body: JSON.stringify({
      board_id: row.board_id,
      title: opts.title,
      description: opts.description,
      link: opts.link,
      media_source: { source_type: 'image_url', url: opts.imageUrl },
    }),
  });

  const body = await res.json() as { id?: string; message?: string };
  if (!res.ok || !body.id) {
    throw new Error(body.message ?? `Pinterest API error (HTTP ${res.status})`);
  }
  return { pinId: body.id };
}
