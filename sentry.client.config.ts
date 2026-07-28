import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Capture 100% of transactions in development; 10% in production.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Replay 1% of sessions, 100% when an error occurs.
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and inputs to protect PHI / biometric session data.
      maskAllText:   true,
      blockAllMedia: true,
    }),
  ],

  // Strip audio frame payloads from breadcrumbs — they contain voice data.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('/api/telemetry')) {
      delete breadcrumb.data.body;
    }
    return breadcrumb;
  },
});
