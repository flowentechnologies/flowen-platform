import posthog from 'posthog-js';
import * as Sentry from '@sentry/nextjs';

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: posthogHost ?? 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    session_recording: { maskAllInputs: false, maskInputOptions: { password: true } },
    autocapture: true,
  });
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
