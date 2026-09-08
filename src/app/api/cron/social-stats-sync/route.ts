/**
 * /api/cron/social-stats-sync
 *
 * Pulls follower/reach stats for the platforms with a real, configured
 * Graph API connection — Instagram + Facebook, via the same Meta access
 * token already used for auto-publishing (src/lib/social/meta-publish.ts)
 * — and upserts today's snapshot into social_platform_stats. Runs daily;
 * follower/reach counts don't need hourly resolution the way ad spend does.
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
import { fetchInstagramStats, fetchFacebookStats, computeFollowerDelta, type PlatformStats } from '@/lib/social/meta-stats';

export const GET = withCronLogging('social-stats-sync', handle);
export const POST = withCronLogging('social-stats-sync', handle);

const PLATFORM_FETCHERS: Record<string, () => Promise<PlatformStats>> = {
  instagram: fetchInstagramStats,
  facebook:  fetchFacebookStats,
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

  for (const [platform, fetchStats] of Object.entries(PLATFORM_FETCHERS)) {
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

      results[platform] = error ? `error: ${error.message}` : 'ok';
    } catch (err) {
      // One platform's Graph API hiccup must not take the other down with it.
      results[platform] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const failed = Object.entries(results).filter(([, v]) => v !== 'ok');
  return NextResponse.json({
    ok:     failed.length === 0,
    results,
    // Top-level `error` (not just nested in `results`) is what
    // withCronLogging inspects to mark a run failed despite the 2xx status.
    error:  failed.length > 0 ? failed.map(([p, v]) => `${p}: ${v}`).join('; ') : null,
  });
}
