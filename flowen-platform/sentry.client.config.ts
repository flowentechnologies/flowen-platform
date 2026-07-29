import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Capture 100% of transactions in development; 10% in production.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay is NOT initialised here — it requires cookie consent (PECR 2003).
  // The CookieConsent component calls Sentry.addIntegration(replayIntegration())
  // only after the user clicks "Accept all".

  // Strip audio frame payloads from breadcrumbs — they contain voice data.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('/api/telemetry')) {
      delete breadcrumb.data.body;
    }
    return breadcrumb;
  },
});
