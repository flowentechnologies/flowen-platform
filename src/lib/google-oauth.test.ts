import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGoogleAccessToken } from './google-oauth';

const ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'] as const;

describe('getGoogleAccessToken', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh-token';
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, originalEnv);
    vi.unstubAllGlobals();
  });

  it('returns the access token on a successful refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200, statusText: 'OK',
      text: async () => JSON.stringify({ access_token: 'a-real-token' }),
    }));
    await expect(getGoogleAccessToken()).resolves.toBe('a-real-token');
  });

  it('includes the HTTP status and Google\'s real error_description when the OAuth error shape is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 400, statusText: 'Bad Request',
      text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }),
    }));
    await expect(getGoogleAccessToken()).rejects.toThrow(/HTTP 400.*Token has been expired or revoked/);
  });

  it('the actual bug this regression-tests: a non-OAuth-shaped error body ("Bad Request" with no error/error_description fields) must not collapse to a single uninformative word — the raw body and HTTP status must still be visible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 400, statusText: 'Bad Request',
      text: async () => 'Bad Request',
    }));
    await expect(getGoogleAccessToken()).rejects.toThrow(/HTTP 400.*Bad Request/);
  });

  it('degrades to the raw body rather than throwing when the response is not valid JSON at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 502, statusText: 'Bad Gateway',
      text: async () => '<html><body>502 Bad Gateway</body></html>',
    }));
    await expect(getGoogleAccessToken()).rejects.toThrow(/HTTP 502/);
  });

  it('throws before making any request when env vars are missing', async () => {
    delete process.env.GOOGLE_REFRESH_TOKEN;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(getGoogleAccessToken()).rejects.toThrow(/not configured/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
