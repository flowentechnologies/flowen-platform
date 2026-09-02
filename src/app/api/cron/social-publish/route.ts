/**
 * /api/cron/social-publish
 *
 * Auto-publishes due Instagram + Facebook posts from social_publish_queue
 * via the Meta Graph API. Runs hourly (see vercel.json), matching the
 * on-the-hour scheduling already used across the campaign calendar.
 *
 * LinkedIn rows are never touched here — they're semi-automated (see
 * /admin/social) because Company Page auto-posting requires LinkedIn's
 * enterprise-gated Marketing Developer Platform approval.
 *
 * If Meta isn't configured yet (env vars unset), this no-ops with a 200 —
 * same graceful-skip pattern as /api/track/capi — so an empty cron run
 * before setup is complete never shows up as a failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { isMetaConfigured, publishToInstagram, publishToFacebook } from '@/lib/social/meta-publish';

const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 10; // safety cap per run — this cron fires hourly, calendar posts 1-3x/day

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

  if (!isMetaConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'meta not configured' });
  }

  const client = db();
  const now = new Date().toISOString();

  const { data: due, error: fetchError } = await client
    .from('social_publish_queue')
    .select('*')
    .in('platform', ['instagram', 'facebook'])
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchError) {
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 });
  }

  const results: Array<{ id: string; platform: string; ok: boolean; detail: string }> = [];

  for (const post of due ?? []) {
    if (!post.asset_public_url) {
      await client.from('social_publish_queue').update({
        status: 'failed',
        error_message: 'asset_public_url is not set',
        updated_at: new Date().toISOString(),
      }).eq('id', post.id);
      results.push({ id: post.id, platform: post.platform, ok: false, detail: 'missing asset_public_url' });
      continue;
    }

    const caption = post.hashtags ? `${post.caption}\n\n${post.hashtags}` : post.caption;

    try {
      let externalId: string;
      if (post.platform === 'instagram') {
        const r = await publishToInstagram({ imageUrl: post.asset_public_url, caption });
        externalId = r.mediaId;
      } else {
        const r = await publishToFacebook({ imageUrl: post.asset_public_url, caption });
        externalId = r.postId;
      }

      await client.from('social_publish_queue').update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: externalId,
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq('id', post.id);

      results.push({ id: post.id, platform: post.platform, ok: true, detail: externalId });
    } catch (err) {
      const attempt_count = (post.attempt_count ?? 0) + 1;
      const message = err instanceof Error ? err.message : String(err);

      await client.from('social_publish_queue').update({
        attempt_count,
        status: attempt_count >= MAX_ATTEMPTS ? 'failed' : 'pending',
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', post.id);

      results.push({ id: post.id, platform: post.platform, ok: false, detail: message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
