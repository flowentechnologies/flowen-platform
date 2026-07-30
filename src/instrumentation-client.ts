import * as Sentry from '@sentry/nextjs';

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
