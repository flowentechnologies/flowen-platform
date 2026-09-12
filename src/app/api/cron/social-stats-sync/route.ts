/**
 * /api/cron/social-stats-sync
 *
 * Pulls two things for the platforms with a real, configured Graph API
 * connection — Instagram + Facebook, via the same Meta access token already
 * used for auto-publishing (src/lib/social/meta-publish.ts):
 *
 *   1. Today's account snapshot (followers, reach, impressions, ...) into
 *      social_platform_stats.
 *   2. Recent posts/Stories/Reels (Instagram) and recent Page posts
 *      (Facebook) into social_posts, so "top performing posts/Stories" on
 *      the Social tab reflects real content instead of an empty table.
 *
 * Runs daily; none of this needs hourly resolution the way ad spend does.
 *
 * TikTok, LinkedIn, YouTube, and X have no configured API integration
 * anywhere in this app (no OAuth flow, no stored access token) — this route
 * never touches their rows. They stay whatever was last entered manually
 * via the Supabase Table Editor, exactly as before.
 *
 * No-ops entirely if Meta isn't configured — same graceful-skip pattern as
 * /api/cron/social-publish.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { withCronLogging } from '@/lib/cron-logging';
import { isMetaConfigured } from '@/lib/social/meta-publish';
import {
  fetchInstagramStats, fetchFacebookStats, fetchInstagramPosts, fetchFacebookPosts,
  computeFollowerDelta, summarizeInsightHealth, type PlatformStats, type SocialPostRow,
} from '@/lib/social/meta-stats';

export const GET = withCronLogging('social-stats-sync', handle);
export const POST = withCronLogging('social-stats-sync', handle);

const STATS_FETCHERS: Record<string, () => Promise<PlatformStats>> = {
  instagram: fetchInstagramStats,
  facebook:  fetchFacebookStats,
};

// How many insight metrics each fetcher attempts — see summarizeInsightHealth.
// instagram: reach, views, profile_views, website_clicks. facebook: none —
// page_impressions/page_impressions_unique were permanently sunset by Meta
// (see fetchFacebookStats) and are no longer attempted at all.
const INSIGHT_METRICS_ATTEMPTED: Record<string, number> = {
  instagram: 4,
  facebook:  0,
};

const POST_FETCHERS: Record<string, () => Promise<SocialPostRow[]>> = {
  instagram: fetchInstagramPosts,
  facebook:  fetchFacebookPosts,
};

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'Meta not configured' });
  }

  const client = db();
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const results: Record<string, string> = {};
  let postsSynced = 0;

  for (const [platform, fetchStats] of Object.entries(STATS_FETCHERS)) {
    try {
      const [stats, { data: prevRow }] = await Promise.all([
        fetchStats(),
        client.from('social_platform_stats')
          .select('followers')
          .eq('platform', platform)
          .eq('stat_date', yesterday)
          .maybeSingle(),
      ]);

      const { error } = await client.from('social_platform_stats').upsert({
        platform,
        stat_date:      today,
        followers:      stats.followers,
        follower_delta: computeFollowerDelta(stats.followers, prevRow?.followers ?? null),
        reach:          stats.reach,
        impressions:    stats.impressions,
        profile_visits: stats.profileVisits,
        website_clicks: stats.websiteClicks,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'platform,stat_date' });

      results[`${platform}_stats`] = error
        ? `error: ${error.message}`
        : summarizeInsightHealth(stats.insightErrors, INSIGHT_METRICS_ATTEMPTED[platform] ?? 0);
    } catch (err) {
      // One platform's Graph API hiccup must not take the other down with it.
      results[`${platform}_stats`] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  for (const [platform, fetchPosts] of Object.entries(POST_FETCHERS)) {
    try {
      const posts = await fetchPosts();
      if (posts.length > 0) {
        const { error } = await client.from('social_posts').upsert(posts, { onConflict: 'platform,post_id' });
        results[`${platform}_posts`] = error ? `error: ${error.message}` : `ok (${posts.length})`;
        if (!error) postsSynced += posts.length;
      } else {
        results[`${platform}_posts`] = 'ok (0)';
      }
    } catch (err) {
      results[`${platform}_posts`] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const failed = Object.entries(results).filter(([, v]) => v.startsWith('error'));
  return NextResponse.json({
    ok: failed.length === 0,
    results,
    postsSynced,
    // Top-level `error` (not just nested in `results`) is what
    // withCronLogging inspects to mark a run failed despite the 2xx status.
    error: failed.length > 0 ? failed.map(([p, v]) => `${p}: ${v}`).join('; ') : null,
  });
}
