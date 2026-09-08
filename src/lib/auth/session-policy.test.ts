import { describe, it, expect } from 'vitest';
import { checkSessionAge, MAX_SESSION_AGE_MS } from './session-policy';

describe('checkSessionAge', () => {
  const now = Date.parse('2026-09-08T12:00:00Z');

  it('returns "seed" when the cookie is absent', () => {
    expect(checkSessionAge(undefined, now)).toBe('seed');
  });

  it('returns "seed" for a malformed (non-numeric) cookie value rather than crashing', () => {
    expect(checkSessionAge('not-a-number', now)).toBe('seed');
  });

  it('returns "ok" for a session well within the cap', () => {
    const startedAt = now - 60 * 60 * 1000; // 1 hour old
    expect(checkSessionAge(String(startedAt), now)).toBe('ok');
  });

  it('returns "ok" for a session exactly at the cap (boundary is exclusive)', () => {
    const startedAt = now - MAX_SESSION_AGE_MS;
    expect(checkSessionAge(String(startedAt), now)).toBe('ok');
  });

  it('returns "stale" for a session one millisecond past the cap', () => {
    const startedAt = now - MAX_SESSION_AGE_MS - 1;
    expect(checkSessionAge(String(startedAt), now)).toBe('stale');
  });

  it('returns "stale" for a session far past the cap', () => {
    const startedAt = now - 30 * 24 * 60 * 60 * 1000; // 30 days old
    expect(checkSessionAge(String(startedAt), now)).toBe('stale');
  });
});
