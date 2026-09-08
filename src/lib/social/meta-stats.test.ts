import { describe, it, expect } from 'vitest';
import { computeFollowerDelta } from './meta-stats';

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
