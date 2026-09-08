import { describe, it, expect } from 'vitest';
import { resolveDeckVariant } from './deck-variant';

describe('resolveDeckVariant', () => {
  it('recognizes the real "simple" value', () => {
    expect(resolveDeckVariant('simple')).toBe('simple');
  });

  it('defaults to "detailed" for the real "detailed" value', () => {
    expect(resolveDeckVariant('detailed')).toBe('detailed');
  });

  it('defaults to "detailed" for null/undefined — every pre-migration row', () => {
    expect(resolveDeckVariant(null)).toBe('detailed');
    expect(resolveDeckVariant(undefined)).toBe('detailed');
  });

  it('defaults to "detailed" for any unrecognized value rather than throwing', () => {
    expect(resolveDeckVariant('anything-else')).toBe('detailed');
    expect(resolveDeckVariant(42)).toBe('detailed');
  });
});
