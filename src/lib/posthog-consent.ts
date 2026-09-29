/** All PostHog calls go through this gate. Never queue analytics before consent. */
import posthog from 'posthog-js';

export const IDENTIFIED_USER_ID_KEY = 'flowen_posthog_user_id';

export function hasPostHogConsent(cookie: string | undefined = typeof document !== 'undefined' ? document.cookie : ''): boolean {
  return /(?:^|;\s*)flowen_cookie_consent=all(?:;|$)/.test(cookie ?? '');
}

let started = false;
let initialized = false;

export function startPostHog(): boolean {
  if (!hasPostHogConsent()) return false;
  if (started) return true;
  if (initialized) {
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
    started = true;
    return true;
  }
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) return false;
  posthog.init(token, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    session_recording: { maskAllInputs: false, maskInputOptions: { password: true } },
  });
  initialized = true;
  started = true;
  // A prior necessary-only revocation may have persisted an opt-out flag.
  if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
  return true;
}

export function capturePostHog(event: string, properties?: Record<string, unknown>): void {
  if (started && hasPostHogConsent()) posthog.capture(event, properties);
}

export function capturePostHogException(error: Error): void {
  if (started && hasPostHogConsent()) posthog.captureException(error);
}

export function identifyPostHog(user: { id: string; email?: string | null }): void {
  if (!started || !hasPostHogConsent()) return;
  const previous = localStorage.getItem(IDENTIFIED_USER_ID_KEY);
  if (previous && previous !== user.id) posthog.reset();
  posthog.identify(user.id, user.email ? { email: user.email } : undefined);
  localStorage.setItem(IDENTIFIED_USER_ID_KEY, user.id);
}

export function resetPostHogIdentity(): void {
  if (typeof window === 'undefined') return;
  if (started && localStorage.getItem(IDENTIFIED_USER_ID_KEY)) posthog.reset();
  localStorage.removeItem(IDENTIFIED_USER_ID_KEY);
}

export function revokePostHog(): void {
  // Disable capture synchronously; reset distinct identity and storage before reload.
  if (started) {
    posthog.opt_out_capturing();
    posthog.reset();
  }
  if (typeof window !== 'undefined') localStorage.removeItem(IDENTIFIED_USER_ID_KEY);
  started = false;
}
