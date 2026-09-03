import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Derive the Supabase storage hostname for image allow-listing.
// Falls back to the *.supabase.co wildcard if the URL isn't set yet (e.g. CI).
function supabaseHostname(): string {
  try { return new URL(SUPABASE_URL).hostname; } catch { return '*.supabase.co'; }
}

// CSP is generated dynamically in src/proxy.ts (per-request nonce).
// Only non-CSP security headers are set here so they apply to all routes
// including static files and API routes that the proxy does not cover.
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
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage — user avatars and uploads
      { protocol: 'https', hostname: supabaseHostname() },
      // OAuth provider profile pictures
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },  // Google
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }, // GitHub
      { protocol: 'https', hostname: '*.googleusercontent.com' },    // other Google
    ],
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
  //
  // outputFileTracingIncludes keys are picomatch globs matched against the
  // route pattern, not plain strings — a dynamic segment's brackets ([token])
  // must be escaped or picomatch reads them as a character class (matching a
  // single "t"/"o"/"k"/"e"/"n" character) instead of the literal segment, so
  // the pattern silently never matches and the files never get bundled (this
  // shipped broken in production: ENOENT on Helvetica.afm at request time).
  outputFileTracingIncludes: {
    '/api/reports/my-progress': ['./node_modules/pdfkit/js/data/**/*'],
    // Pitch deck PDF route also needs pdfkit's AFM font metrics + ICC profiles
    '/api/pitch/\\[token\\]/pdf': ['./node_modules/pdfkit/js/data/**/*'],
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
