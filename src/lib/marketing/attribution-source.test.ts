import { describe, it, expect } from 'vitest';
import { resolveAttributionSource } from './attribution-source';

describe('resolveAttributionSource', () => {
  it('uses the real utm_source value, not just its truthiness (the regression this guards)', () => {
    // Before the fix, any truthy utm_source got bucketed as 'meta'
    // regardless of what it actually said.
    expect(resolveAttributionSource('google', null, null)).toBe('google');
    expect(resolveAttributionSource('newsletter', null, null)).toBe('newsletter');
  });

  it('infers "meta" from fbclid when utm_source is absent', () => {
    expect(resolveAttributionSource(null, 'fb.123', null)).toBe('meta');
  });

  it('infers "google" from gclid when utm_source and fbclid are absent', () => {
    expect(resolveAttributionSource(null, null, 'gclid123')).toBe('google');
  });

  it('falls back to "direct" when nothing is present', () => {
    expect(resolveAttributionSource(null, null, null)).toBe('direct');
  });

  it('prefers utm_source over any click ID when both are present', () => {
    expect(resolveAttributionSource('google', 'fb.123', null)).toBe('google');
  });

  it('prefers fbclid over gclid when utm_source is absent and both click IDs are present', () => {
    expect(resolveAttributionSource(null, 'fb.123', 'gclid123')).toBe('meta');
  });
});
