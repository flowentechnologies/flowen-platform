/**
 * Meta Graph API stats — Instagram + Facebook account metrics and recent
 * post/story performance.
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

export interface SocialPostRow {
  platform:     'instagram' | 'facebook';
  post_id:      string;
  content_type: 'feed' | 'story' | 'reel';
  hook:         string | null;
  published_at: string;
  views:        number | null;
  reach:        number | null;
  impressions:  number | null;
  likes:        number | null;
  comments:     number | null;
  shares:       number | null;
  saves:        number | null;
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
 * Reads one account-level insights metric's most recent daily value.
 * Insight metric names and availability shift between Graph API versions
 * and account types (e.g. `impressions` was dropped for some IG account
 * types) — a single unsupported metric must not sink the whole sync, so
 * this swallows the error and reports the metric as unavailable (null)
 * rather than throwing.
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

/**
 * Same defensive shape as safeDailyInsight, for a single media/post object
 * rather than an account rolled up by day — post-level insights take no
 * `period`, just `metric`, and a `total_value` shape on current API
 * versions rather than a values array.
 */
async function safeMediaInsight(mediaId: string, metric: string, accessToken: string): Promise<number | null> {
  try {
    const data = await graphGet<{ data: Array<{ values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
      `${mediaId}/insights`,
      { metric, access_token: accessToken },
    );
    const row = data.data?.[0];
    if (!row) return null;
    if (row.total_value) return row.total_value.value;
    return row.values?.length ? row.values[row.values.length - 1].value : null;
  } catch {
    return null;
  }
}

export async function fetchInstagramStats(): Promise<PlatformStats> {
  const igUserId = process.env.META_IG_USER_ID!;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN!;

  const [profile, reach, impressions, profileVisits, websiteClicks] = await Promise.all([
    graphGet<{ followers_count?: number }>(igUserId, { fields: 'followers_count', access_token: accessToken }),
    safeDailyInsight(igUserId, 'reach', accessToken),
    // Deprecated at the account/day level for some newer IG account types —
    // attempted anyway rather than assumed unavailable; degrades to null on
    // this specific account/API-version combination if it really isn't there.
    safeDailyInsight(igUserId, 'impressions', accessToken),
    safeDailyInsight(igUserId, 'profile_views', accessToken),
    safeDailyInsight(igUserId, 'website_clicks', accessToken),
  ]);

  return {
    followers: profile.followers_count ?? null,
    reach, impressions, profileVisits, websiteClicks,
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
 * Recent Instagram media (feed posts, Reels, and Stories together —
 * distinguished via media_product_type, the real field Meta uses for this).
 * like_count/comments_count come straight off the media object itself
 * (stable across every API version, no insights call needed); reach is
 * attempted per-item via insights and degrades to null on failure —
 * "views" and "saves" are deliberately left null rather than guessed, since
 * their availability and exact metric name vary by media type and account
 * in ways not safe to assume without live verification against the real
 * account.
 */
export async function fetchInstagramPosts(limit = 25): Promise<SocialPostRow[]> {
  const igUserId = process.env.META_IG_USER_ID!;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN!;

  const media = await graphGet<{
    data: Array<{
      id: string;
      media_product_type?: string;
      timestamp: string;
      caption?: string;
      like_count?: number;
      comments_count?: number;
    }>;
  }>(`${igUserId}/media`, {
    fields: 'id,media_product_type,timestamp,caption,like_count,comments_count',
    limit: String(limit),
    access_token: accessToken,
  });

  return Promise.all((media.data ?? []).map(async m => {
    const contentType: SocialPostRow['content_type'] =
      m.media_product_type === 'STORY' ? 'story' :
      m.media_product_type === 'REELS' ? 'reel' : 'feed';

    const reach = await safeMediaInsight(m.id, 'reach', accessToken);

    return {
      platform:     'instagram' as const,
      post_id:      m.id,
      content_type: contentType,
      hook:         m.caption ? m.caption.split('\n')[0].slice(0, 120) : null,
      published_at: m.timestamp,
      views:        null,
      reach,
      impressions:  null,
      likes:        m.like_count ?? null,
      comments:     m.comments_count ?? null,
      shares:       null,
      saves:        null,
    };
  }));
}

/**
 * Recent Facebook Page posts. Likes/comments/shares come from the post
 * object's own summary fields — stable, no insights API involved. Facebook
 * has no equivalent "Story" content type reliably exposed through the
 * standard Page posts endpoint, so every row here is 'feed'.
 */
export async function fetchFacebookPosts(limit = 25): Promise<SocialPostRow[]> {
  const pageId = process.env.META_PAGE_ID!;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN!;

  const posts = await graphGet<{
    data: Array<{
      id: string;
      created_time: string;
      message?: string;
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }>;
  }>(`${pageId}/posts`, {
    fields: 'id,created_time,message,likes.summary(true),comments.summary(true),shares',
    limit: String(limit),
    access_token: accessToken,
  });

  return (posts.data ?? []).map(p => ({
    platform:     'facebook' as const,
    post_id:      p.id,
    content_type: 'feed' as const,
    hook:         p.message ? p.message.split('\n')[0].slice(0, 120) : null,
    published_at: p.created_time,
    views:        null,
    reach:        null,
    impressions:  null,
    likes:        p.likes?.summary?.total_count ?? null,
    comments:     p.comments?.summary?.total_count ?? null,
    shares:       p.shares?.count ?? null,
    saves:        null,
  }));
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
