/**
 * Pure transforms behind the Social tab's time-period selector and
 * top-posts/stories ranking. No network, no DB — everything here operates
 * on rows already fetched by the page, so it's cheap to unit test directly
 * rather than only through the rendered component.
 */

export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodDays = typeof PERIOD_OPTIONS[number];

/** Keeps rows whose date field falls within the trailing `days` window, ending at `now`. Rows with a missing/unparseable date are dropped rather than guessed into the window. */
export function filterByPeriod<T>(
  rows: T[],
  dateField: (row: T) => string | null | undefined,
  days: number,
  now: Date = new Date(),
): T[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return rows.filter(row => {
    const raw = dateField(row);
    if (!raw) return false;
    const t = Date.parse(raw);
    return Number.isFinite(t) && t >= cutoff && t <= now.getTime();
  });
}

export interface RankablePost {
  views?:    number | null;
  likes?:    number | null;
  comments?: number | null;
  shares?:   number | null;
  saves?:    number | null;
  reach?:    number | null;
}

/**
 * Views is the clearest single "performance" number when a platform reports
 * it, but real Meta post data usually won't (see fetchInstagramPosts/
 * fetchFacebookPosts — neither populates it, since its availability isn't
 * safe to assume across media types without live verification). Falling
 * back to a weighted engagement score keeps ranking meaningful on exactly
 * the data this app can actually, honestly pull today, rather than showing
 * an empty "top posts" list until a views figure someday exists.
 */
export function engagementScore(post: RankablePost): number {
  return (post.likes ?? 0) + (post.comments ?? 0) * 2 + (post.shares ?? 0) * 3 + (post.saves ?? 0) * 2;
}

export function rankPosts<T extends RankablePost>(posts: T[], limit = 8): T[] {
  return [...posts]
    .sort((a, b) => {
      const aViews = a.views ?? 0;
      const bViews = b.views ?? 0;
      if (aViews !== bViews) return bViews - aViews;
      return engagementScore(b) - engagementScore(a);
    })
    .slice(0, limit);
}

export interface HasContentType {
  content_type?: string | null;
}

export function splitStories<T extends HasContentType>(posts: T[]): { stories: T[]; other: T[] } {
  const stories: T[] = [];
  const other: T[] = [];
  for (const p of posts) {
    (p.content_type === 'story' ? stories : other).push(p);
  }
  return { stories, other };
}
