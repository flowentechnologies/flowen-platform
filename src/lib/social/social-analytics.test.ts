import { describe, it, expect } from 'vitest';
import { filterByPeriod, engagementScore, rankPosts, splitStories } from './social-analytics';

describe('filterByPeriod', () => {
  const now = new Date('2026-09-08T12:00:00Z');

  it('keeps a row from exactly 1 day ago within a 7-day window', () => {
    const rows = [{ d: '2026-09-07T12:00:00Z' }];
    expect(filterByPeriod(rows, r => r.d, 7, now)).toEqual(rows);
  });

  it('drops a row older than the window', () => {
    const rows = [{ d: '2026-08-01T12:00:00Z' }];
    expect(filterByPeriod(rows, r => r.d, 7, now)).toEqual([]);
  });

  it('drops a row with a missing date rather than guessing it into the window', () => {
    const rows = [{ d: null }];
    expect(filterByPeriod(rows, r => r.d, 30, now)).toEqual([]);
  });

  it('drops a row with an unparseable date', () => {
    const rows = [{ d: 'not-a-date' }];
    expect(filterByPeriod(rows, r => r.d, 30, now)).toEqual([]);
  });

  it('excludes a row dated after `now`', () => {
    const rows = [{ d: '2026-09-09T12:00:00Z' }];
    expect(filterByPeriod(rows, r => r.d, 30, now)).toEqual([]);
  });

  it('keeps a row exactly at the cutoff boundary', () => {
    const rows = [{ d: '2026-09-01T12:00:00Z' }]; // exactly 7 days before now
    expect(filterByPeriod(rows, r => r.d, 7, now)).toEqual(rows);
  });
});

describe('engagementScore', () => {
  it('weights comments and saves double, shares triple, likes at 1x', () => {
    expect(engagementScore({ likes: 10, comments: 5, shares: 2, saves: 3 })).toBe(10 + 10 + 6 + 6);
  });

  it('treats missing fields as 0', () => {
    expect(engagementScore({})).toBe(0);
  });
});

describe('rankPosts', () => {
  it('ranks by views first when present', () => {
    const posts = [{ id: 'a', views: 10 }, { id: 'b', views: 100 }];
    expect(rankPosts(posts).map(p => p.id)).toEqual(['b', 'a']);
  });

  it('falls back to engagement score when views are absent (the real shape Meta post data comes in as today)', () => {
    const posts = [
      { id: 'low',  likes: 1 },
      { id: 'high', likes: 50, comments: 10 },
    ];
    expect(rankPosts(posts).map(p => p.id)).toEqual(['high', 'low']);
  });

  it('respects the limit', () => {
    const posts = Array.from({ length: 20 }, (_, i) => ({ id: i, views: i }));
    expect(rankPosts(posts, 5)).toHaveLength(5);
  });

  it('breaks a views tie using engagement score', () => {
    const posts = [
      { id: 'a', views: 10, likes: 1 },
      { id: 'b', views: 10, likes: 99 },
    ];
    expect(rankPosts(posts).map(p => p.id)).toEqual(['b', 'a']);
  });
});

describe('splitStories', () => {
  it('separates story content from everything else', () => {
    const posts = [
      { id: 1, content_type: 'story' },
      { id: 2, content_type: 'feed' },
      { id: 3, content_type: 'reel' },
      { id: 4, content_type: 'story' },
    ];
    const { stories, other } = splitStories(posts);
    expect(stories.map(p => p.id)).toEqual([1, 4]);
    expect(other.map(p => p.id)).toEqual([2, 3]);
  });

  it('treats a missing content_type as "other"', () => {
    const { stories, other } = splitStories<{ id: number; content_type?: string }>([{ id: 1 }]);
    expect(stories).toHaveLength(0);
    expect(other).toHaveLength(1);
  });
});
