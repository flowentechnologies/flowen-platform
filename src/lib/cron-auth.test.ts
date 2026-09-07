import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { verifyCronSecret, verifyCronRequest } from './cron-auth';

// Security-critical gate for every /api/cron/* and /api/admin/*-triggered
// job in the app — a bypass here means anyone can fire a scheduled job
// (send emails, sync billing, run GDPR sweeps) without authorization.

describe('verifyCronSecret', () => {
  const ORIGINAL_ENV = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_ENV;
  });

  it('accepts the correct secret', () => {
    expect(verifyCronSecret('test-secret-value')).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(verifyCronSecret('wrong-secret')).toBe(false);
  });

  it('rejects a secret that differs only in length', () => {
    expect(verifyCronSecret('test-secret-value-extra')).toBe(false);
    expect(verifyCronSecret('test-secret-valu')).toBe(false);
  });

  it('rejects null', () => {
    expect(verifyCronSecret(null)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(verifyCronSecret('')).toBe(false);
  });

  it('rejects everything when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronSecret('test-secret-value')).toBe(false);
    expect(verifyCronSecret('')).toBe(false);
  });
});

describe('verifyCronRequest', () => {
  const ORIGINAL_ENV = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value';
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_ENV;
  });

  function headersWith(values: Record<string, string>) {
    const map = new Map(Object.entries(values));
    return { get: (name: string) => map.get(name.toLowerCase()) ?? null };
  }

  it('accepts the x-cron-secret header (admin manual-trigger path)', () => {
    expect(verifyCronRequest(headersWith({ 'x-cron-secret': 'test-secret-value' }))).toBe(true);
  });

  it('accepts Authorization: Bearer <secret> (Vercel scheduled cron path)', () => {
    expect(verifyCronRequest(headersWith({ authorization: 'Bearer test-secret-value' }))).toBe(true);
  });

  it('is case-insensitive on the Bearer prefix', () => {
    expect(verifyCronRequest(headersWith({ authorization: 'bearer test-secret-value' }))).toBe(true);
  });

  it('rejects a request with neither header', () => {
    expect(verifyCronRequest(headersWith({}))).toBe(false);
  });

  it('rejects a request with the wrong secret in either header', () => {
    expect(verifyCronRequest(headersWith({ 'x-cron-secret': 'nope' }))).toBe(false);
    expect(verifyCronRequest(headersWith({ authorization: 'Bearer nope' }))).toBe(false);
  });
});
