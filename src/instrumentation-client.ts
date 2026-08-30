import posthog from 'posthog-js';
import * as Sentry from '@sentry/nextjs';

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (posthogToken && posthogHost) {
  // Defer PostHog initialisation until the browser is idle so it doesn't
  // block LCP or inflate TBT. Falls back to a 4-second timeout on browsers
  // that don't support requestIdleCallback (Safari < 16.4).
  const initPostHog = () => {
    posthog.init(posthogToken, {
      api_host: posthogHost,
      capture_pageview: false,
      capture_pageleave: true,
      capture_exceptions: true,
      session_recording: { maskAllInputs: false, maskInputOptions: { password: true } },
    });
  };

  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
        .requestIdleCallback(initPostHog, { timeout: 4000 });
    } else {
      setTimeout(initPostHog, 4000);
    }
  }
} else if (process.env.NODE_ENV === 'development') {
  const missingVariable = posthogToken
    ? 'NEXT_PUBLIC_POSTHOG_HOST'
    : 'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN';
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}

Sentry.init({
  dsn: 'https://010726adaecb386ff1a525bae3b7cbfe@o4511814939246592.ingest.de.sentry.io/4511823825862736',

  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enableLogs: true,

  // Session Replay is NOT initialised here — it requires cookie consent (PECR 2003).
  // The CookieConsent component calls Sentry.addIntegration(replayIntegration())
  // only after the user clicks "Accept all".

  // Strip audio frame payloads from breadcrumbs — they contain voice data.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('/api/telemetry')) {
      delete breadcrumb.data.body;
    }
    return breadcrumb;
  },

  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
