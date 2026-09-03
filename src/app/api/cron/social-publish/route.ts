/**
 * /api/cron/social-publish
 *
 * Auto-publishes due posts from social_publish_queue for every platform
 * with a real, self-serve publish API: Instagram + Facebook (Meta Graph
 * API) and Pinterest (API v5). Runs hourly (see vercel.json), matching the
 * on-the-hour scheduling already used across the campaign calendar.
 *
 * LinkedIn and Snapchat rows are never touched here — both are
 * semi-automated (see /admin/social) because their organic-posting APIs are
 * gated behind approval this app can't get on its own: LinkedIn's Company
 * Page auto-posting needs the enterprise-gated Marketing Developer
 * Platform, and Snapchat's Public Profile API is allowlist-only (Snap must
 * manually approve the app's client ID via a business contact).
 *
 * Each platform no-ops independently if unconfigured — same graceful-skip
 * pattern as /api/track/capi — so partial setup never shows up as a
 * failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { isMetaConfigured, publishToInstagram, publishToFacebook } from '@/lib/social/meta-publish';
import { isPinterestConfigured, publishToPinterest } from '@/lib/social/pinterest-publish';

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

  const metaOk = isMetaConfigured();
  const pinterestOk = await isPinterestConfigured();
  const platforms = [
    ...(metaOk ? ['instagram', 'facebook'] : []),
    ...(pinterestOk ? ['pinterest'] : []),
  ];

  if (platforms.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no platforms configured' });
  }

  const client = db();
  const now = new Date().toISOString();

  const { data: due, error: fetchError } = await client
    .from('social_publish_queue')
    .select('*')
    .in('platform', platforms)
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
      } else if (post.platform === 'facebook') {
        const r = await publishToFacebook({ imageUrl: post.asset_public_url, caption });
        externalId = r.postId;
      } else {
        // Pinterest wants a short title distinct from the body — the
        // caption's first line reads as a natural title across this
        // calendar's posts (e.g. "F is for Fluency.", "Your caseload, at a
        // glance.").
        const title = post.caption.split('\n')[0].slice(0, 100);
        const r = await publishToPinterest({
          imageUrl: post.asset_public_url,
          title,
          description: caption,
          link: 'https://flowen.digital',
        });
        externalId = r.pinId;
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
