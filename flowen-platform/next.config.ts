import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps in CI only — keeps local builds fast.
  silent: !process.env.CI,

  widenClientFileUpload: true,

  sourcemaps: {
    // Delete local source map files after upload so they're not shipped to clients.
    deleteSourcemapsAfterUpload: true,
  },
});
