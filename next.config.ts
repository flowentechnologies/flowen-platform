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
    // camera=(self) allows getUserMedia on the page itself (face tracking)
    value: 'camera=(self), geolocation=(), microphone=(self), payment=(self "https://js.stripe.com")',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      `default-src 'self'`,
      // 'wasm-unsafe-eval' required for WebAssembly compilation (MediaPipe)
      `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://*.doubleclick.net https://connect.facebook.net https://analytics.tiktok.com https://snap.licdn.com https://static.hotjar.com https://www.clarity.ms https://static.ads-twitter.com https://*.posthog.com`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: https:`,
      `font-src 'self' data:`,
      // Sentry tunnel proxies browser events through /monitoring — no external ingest needed
      // cdn.jsdelivr.net + storage.googleapis.com needed for MediaPipe WASM + model download
      `connect-src 'self' ${SUPABASE_URL} wss://*.supabase.co https://*.supabase.co https://api.stripe.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com https://www.googleadservices.com https://*.doubleclick.net https://*.facebook.com https://analytics.tiktok.com https://px.ads.linkedin.com https://static.ads-twitter.com https://*.hotjar.com https://www.clarity.ms https://eu.i.posthog.com https://cdn.jsdelivr.net https://storage.googleapis.com`,
      `frame-src https://js.stripe.com https://hooks.stripe.com https://*.doubleclick.net`,
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
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*' }],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Preload the hero video on the landing page at the HTTP layer —
        // avoids placing a <link> tag in the client component body.
        source: '/',
        headers: [
          {
            key: 'Link',
            value: '</assets/videos/Flowen_Hero.mp4>; rel=preload; as=video; type=video/mp4',
          },
        ],
      },
      {
        // The investor pitch deck is a standalone HTML page served via a
        // token-gated API route.  It intentionally loads Tailwind CSS,
        // Google Fonts, and FontAwesome from public CDNs — allow them here.
        // This rule is placed LAST so its CSP key overrides the catch-all
        // above for this path (Next.js applies all matching rules in order;
        // duplicate header keys from later rules win).
        source: '/api/pitch/:token*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              `default-src 'self'`,
              `script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com`,
              `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com`,
              `font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com`,
              `img-src 'self' data: blob: https:`,
              `connect-src 'self'`,
              `media-src 'self' blob:`,
              `object-src 'none'`,
              `base-uri 'self'`,
            ].join('; '),
          },
          // Confidential — never cached or indexed
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },

  // pdfkit reads AFM font metrics and ICC colour profiles from disk at runtime.
  // Vercel's output-file-tracing misses these because they're accessed via
  // dynamic require paths inside the library, so we explicitly include them
  // for the PDF generation route so they're bundled into the serverless function.
  outputFileTracingIncludes: {
    '/api/reports/my-progress': ['./node_modules/pdfkit/js/data/**/*'],
    // Pitch deck PDF route also needs pdfkit's AFM font metrics + ICC profiles
    '/api/pitch/[token]/pdf': ['./node_modules/pdfkit/js/data/**/*'],
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
