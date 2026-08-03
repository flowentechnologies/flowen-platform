import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowen.digital';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(self), payment=(self "https://js.stripe.com")',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://analytics.tiktok.com https://snap.licdn.com https://static.hotjar.com https://www.clarity.ms https://static.ads-twitter.com https://*.posthog.com`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: https:`,
      `font-src 'self' data:`,
      // Sentry tunnel proxies browser events through /monitoring — no external ingest needed
      `connect-src 'self' ${SUPABASE_URL} wss://*.supabase.co https://*.supabase.co https://api.stripe.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://*.facebook.com https://analytics.tiktok.com https://px.ads.linkedin.com https://static.ads-twitter.com https://*.hotjar.com https://www.clarity.ms https://eu.i.posthog.com`,
      `frame-src https://js.stripe.com https://hooks.stripe.com`,
      `worker-src 'self' blob:`,
      `media-src 'self' blob:`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `upgrade-insecure-requests`,
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org:     'flowen-technologies-limited',
  project: 'javascript-nextjs',

  silent: !process.env.CI,

  widenClientFileUpload: true,

  // Route browser Sentry requests through Next.js to avoid ad-blockers
  tunnelRoute: '/monitoring',

  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
