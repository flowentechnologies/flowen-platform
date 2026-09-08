/**
 * Meta Graph API stats — Instagram + Facebook follower/reach metrics.
 *
 * Reuses the exact same long-lived access token already configured for
 * auto-publishing (src/lib/social/meta-publish.ts, isMetaConfigured()) — an
 * account this app can already post to can also read its own public
 * insights with that same token. No extra OAuth scope, no separate
 * approval, no new credential to go get.
 *
 * TikTok, LinkedIn, YouTube, and X have no configured API connection
 * anywhere in this app (no OAuth flow, no stored token) — this file
 * deliberately only covers the two platforms that do.
 */

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface PlatformStats {
  followers:     number | null;
  reach:         number | null;
  impressions:   number | null;
  profileVisits: number | null;
  websiteClicks: number | null;
}

interface GraphError {
  error?: { message?: string };
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  const body = await res.json() as T & GraphError;
  if (!res.ok || body.error) {
    throw new Error(body.error?.message ?? `Graph API error (HTTP ${res.status})`);
  }
  return body;
}

/**
 * Reads one insights metric's most recent daily value. Insight metric names
 * and availability shift between Graph API versions and account types
 * (e.g. `impressions` was dropped for some IG account types) — a single
 * unsupported metric must not sink the whole sync, so this swallows the
 * error and reports the metric as unavailable rather than throwing.
 */
async function safeDailyInsight(objectId: string, metric: string, accessToken: string): Promise<number | null> {
  try {
    const data = await graphGet<{ data: Array<{ values: Array<{ value: number }> }> }>(
      `${objectId}/insights`,
      { metric, period: 'day', access_token: accessToken },
    );
    const values = data.data?.[0]?.values;
    return values?.length ? values[values.length - 1].value : null;
  } catch {
    return null;
  }
}

export async function fetchInstagramStats(): Promise<PlatformStats> {
  const igUserId = process.env.META_IG_USER_ID!;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN!;

  const [profile, reach, profileVisits, websiteClicks] = await Promise.all([
    graphGet<{ followers_count?: number }>(igUserId, { fields: 'followers_count', access_token: accessToken }),
    safeDailyInsight(igUserId, 'reach', accessToken),
    safeDailyInsight(igUserId, 'profile_views', accessToken),
    safeDailyInsight(igUserId, 'website_clicks', accessToken),
  ]);

  return {
    followers: profile.followers_count ?? null,
    reach, profileVisits, websiteClicks,
    impressions: null, // deprecated at the user level for IG accounts on current Graph API versions
  };
}

export async function fetchFacebookStats(): Promise<PlatformStats> {
  const pageId = process.env.META_PAGE_ID!;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN!;

  const [profile, impressions, reach] = await Promise.all([
    graphGet<{ followers_count?: number; fan_count?: number }>(pageId, { fields: 'followers_count,fan_count', access_token: accessToken }),
    safeDailyInsight(pageId, 'page_impressions', accessToken),
    safeDailyInsight(pageId, 'page_impressions_unique', accessToken),
  ]);

  return {
    followers: profile.followers_count ?? profile.fan_count ?? null,
    impressions, reach,
    profileVisits: null,
    websiteClicks: null,
  };
}

/**
 * Pure — no network, no DB. Null on either side means "no comparison
 * possible" (first sync ever, or yesterday's row is missing/manual), not 0:
 * a 0 delta is a real, meaningful value (no follower change) and must not
 * be confused with "we don't know."
 */
export function computeFollowerDelta(todayFollowers: number | null, yesterdayFollowers: number | null): number | null {
  if (todayFollowers === null || yesterdayFollowers === null) return null;
  return todayFollowers - yesterdayFollowers;
}
