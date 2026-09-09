import { describe, it, expect } from 'vitest';
import { computeFollowerDelta, summarizeInsightHealth } from './meta-stats';

describe('computeFollowerDelta', () => {
  it('returns the difference when both values are known', () => {
    expect(computeFollowerDelta(1050, 1000)).toBe(50);
  });

  it('returns a negative delta on follower loss', () => {
    expect(computeFollowerDelta(990, 1000)).toBe(-10);
  });

  it('returns 0 as a real value, not null, when nothing changed', () => {
    expect(computeFollowerDelta(1000, 1000)).toBe(0);
  });

  it('returns null when today is unknown', () => {
    expect(computeFollowerDelta(null, 1000)).toBeNull();
  });

  it('returns null when yesterday is unknown (first sync ever, or a manual gap)', () => {
    expect(computeFollowerDelta(1000, null)).toBeNull();
  });

  it('returns null when both are unknown', () => {
    expect(computeFollowerDelta(null, null)).toBeNull();
  });
});

describe('summarizeInsightHealth', () => {
  it('reports "ok" when nothing failed', () => {
    expect(summarizeInsightHealth(undefined, 4)).toBe('ok');
    expect(summarizeInsightHealth([], 4)).toBe('ok');
  });

  it('reports a real error when every attempted metric failed — the actual bug this exists to catch: reach/impressions/profile_visits/website_clicks all silently null every day, previously indistinguishable from success', () => {
    const result = summarizeInsightHealth(
      ['reach: (#10) permission denied', 'impressions: (#10) permission denied'],
      2,
    );
    expect(result).toMatch(/^error:/);
    expect(result).toContain('all 2 insight metrics failed');
  });

  it('reports a degraded-but-ok status when only some metrics failed', () => {
    const result = summarizeInsightHealth(['impressions: not supported for this account type'], 4);
    expect(result).not.toMatch(/^error:/);
    expect(result).toContain('1/4 insights degraded');
  });
});
