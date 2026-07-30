import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://010726adaecb386ff1a525bae3b7cbfe@o4511814939246592.ingest.de.sentry.io/4511823825862736',

  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enableLogs: true,

  // Do not send full request body — it may contain PHI or auth tokens.
  sendDefaultPii: false,
});
