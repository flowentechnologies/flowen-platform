import { beforeEach, describe, expect, it, vi } from 'vitest';

const ph = vi.hoisted(() => ({
  init: vi.fn(), capture: vi.fn(), captureException: vi.fn(), identify: vi.fn(),
  reset: vi.fn(), opt_out_capturing: vi.fn(), opt_in_capturing: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
}));
vi.mock('posthog-js', () => ({ default: ph }));

import { hasPostHogConsent, startPostHog, capturePostHog, capturePostHogException,
  identifyPostHog, revokePostHog, resetPostHogIdentity } from './posthog-consent';

let cookie = '';
const storage = new Map<string, string>();

beforeEach(() => {
  vi.clearAllMocks();
  cookie = '';
  storage.clear();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { get cookie() { return cookie; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'test-token';
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.i.posthog.com';
  revokePostHog();
  vi.clearAllMocks();
});

describe('PostHog consent gate', () => {
  it('never initializes, identifies or captures without all consent, including necessary only', () => {
    expect(startPostHog()).toBe(false);
    capturePostHog('preconsent');
    capturePostHogException(new Error('preconsent'));
    identifyPostHog({ id: 'user' });
    cookie = 'flowen_cookie_consent=necessary';
    expect(startPostHog()).toBe(false);
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
    expect(ph.identify).not.toHaveBeenCalled();
    expect(ph.captureException).not.toHaveBeenCalled();
  });

  it('requires an exact consent cookie value', () => {
    expect(hasPostHogConsent('flowen_cookie_consent=all-but-not-really')).toBe(false);
    expect(hasPostHogConsent('other=1; flowen_cookie_consent=all; more=2')).toBe(true);
  });

  it('starts once after all consent, captures and identifies, then stops synchronously on revocation', () => {
    cookie = 'flowen_cookie_consent=all';
    expect(startPostHog()).toBe(true);
    expect(startPostHog()).toBe(true);
    expect(ph.init).toHaveBeenCalledTimes(1);
    capturePostHog('$pageview', { $current_url: '/pricing' });
    identifyPostHog({ id: 'user', email: 'test@example.com' });
    expect(ph.capture).toHaveBeenCalledWith('$pageview', { $current_url: '/pricing' });
    expect(ph.identify).toHaveBeenCalledWith('user', { email: 'test@example.com' });
    cookie = 'flowen_cookie_consent=necessary';
    revokePostHog();
    capturePostHog('after-revoke');
    identifyPostHog({ id: 'user' });
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(ph.reset).toHaveBeenCalledTimes(1);
    expect(ph.capture).toHaveBeenCalledTimes(1);
    expect(ph.identify).toHaveBeenCalledTimes(1);
    expect(storage.has('flowen_posthog_user_id')).toBe(false);
  });

  it('resumes only after a new all decision and clears persisted opt-out', () => {
    cookie = 'flowen_cookie_consent=all';
    ph.has_opted_out_capturing.mockReturnValueOnce(true);
    expect(startPostHog()).toBe(true);
    expect(ph.opt_in_capturing).toHaveBeenCalledTimes(1);
    resetPostHogIdentity();
  });
});
