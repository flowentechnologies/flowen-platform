import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isR2Configured } from './r2';

const ENV_KEYS = [
  'STORAGE_R2_ACCOUNT_ID',
  'STORAGE_R2_ACCESS_KEY_ID',
  'STORAGE_R2_SECRET_ACCESS_KEY',
  'STORAGE_R2_BUCKET_NAME',
] as const;

describe('isR2Configured', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, originalEnv);
  });

  it('is false when no R2 env vars are set (the default, unconfigured state)', () => {
    expect(isR2Configured()).toBe(false);
  });

  for (const missing of ENV_KEYS) {
    it(`is false when only ${missing} is missing`, () => {
      for (const key of ENV_KEYS) {
        if (key !== missing) process.env[key] = 'test-value';
      }
      expect(isR2Configured()).toBe(false);
    });
  }

  it('is true once all four R2 env vars are set', () => {
    for (const key of ENV_KEYS) process.env[key] = 'test-value';
    expect(isR2Configured()).toBe(true);
  });
});
