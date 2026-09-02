// Next.js 16 proxy entry point — supersedes src/middleware.ts (deprecated convention).
// Run `npx @next/codemod@canary middleware-to-proxy .` to apply the official rename codemod.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applyIdentityGuard } from '@/middleware/identity-guard';
import { applyAffiliateReferral } from '@/middleware/affiliate-referral';
import { checkProxyRateLimit } from '@/lib/rate-limit';

// ── Analytics constants ───────────────────────────────────────────────────────

const VS_COOKIE      = '__vs';
const UTM_COOKIE     = '__utm';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const UTM_PARAMS     = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

// ── Marketing attribution constants ───────────────────────────────────────────

// Long-lived anonymous ID cookie — survives session boundaries and is the
// primary key for the marketing_attribution table.
const ANON_ATTR_COOKIE     = 'flowen_anon_id';
const ANON_ATTR_MAX_AGE    = 60 * 60 * 24 * 365; // 1 year

// Ad-network click ID query parameters we listen for.
// Only capture non-null values — absent IDs are never written to the DB.
const CLICK_ID_PARAMS = ['gclid', 'fbclid', 'ttclid', 'msclkid'] as const;
type ClickIdParam = typeof CLICK_ID_PARAMS[number];

// ── Attribution helpers ───────────────────────────────────────────────────────

/**
 * Truncates an IP address for privacy compliance.
 * IPv4: zeroes the last octet  (e.g. 192.168.1.100 → 192.168.1.0)
 * IPv6: keeps only the first 4 hextets (network prefix)
 *
 * The truncated value still provides enough signal for ad-network CAPI
 * matching while preventing exact user localisation in our own DB.
 */
function anonymizeIp(ip: string): string {
  const v4 = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)\d{1,3}$/);
  if (v4) return `${v4[1]}0`;
  const parts = ip.split(':');
  if (parts.length >= 4) return `${parts.slice(0, 4).join(':')}::`;
  return ip;
}

/**
 * Writes attribution data to marketing_attribution via the Supabase REST API.
 *
 * Uses a raw fetch rather than the SDK to keep the proxy bundle lightweight —
 * the SDK adds ~20 kB that is wasted when most requests carry no click IDs.
 *
 * The `Prefer: resolution=merge-duplicates` header instructs PostgREST to run
 * an upsert (INSERT … ON CONFLICT DO UPDATE). Only columns present in the body
 * are updated, so a return visit without new click IDs won't clobber existing
 * attribution data.
 *
 * Called fire-and-forget — Vercel Fluid Compute keeps the instance alive long
 * enough for the write to settle without adding latency to the HTTP response.
 */
async function captureAttribution(
  anonId: string,
  record: Partial<{
    gclid: string; fbclid: string; ttclid: string; msclkid: string;
    utm_source: string; utm_medium: string; utm_campaign: string;
    utm_content: string; utm_term: string;
    referrer: string; landing_page: string;
    ip_address: string; user_agent: string;
  }>,
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/marketing_attribution`;
  await fetch(url, {
    method:  'POST',
    headers: {
      apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization:  `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
      // Upsert on primary key (anonymous_id). Only specified columns are
      // updated on conflict — absent columns retain their existing values.
      Prefer:         'resolution=merge-duplicates',
    },
    body: JSON.stringify({ anonymous_id: anonId, ...record }),
  });
}

// Rate limiting is handled by the distributed Upstash-backed checkProxyRateLimit
// imported above.  See src/lib/rate-limit.ts for limits and fallback behaviour.

// ── CSP builder ───────────────────────────────────────────────────────────────

/**
 * Builds a per-request Content-Security-Policy with a unique nonce.
 * Replaces the static 'unsafe-inline' in script-src with:
 *   'nonce-<n>'  — allows only the FOUC script that carries the nonce
 *   'strict-dynamic' — allows scripts added programmatically by trusted scripts
 *                      (e.g. TrackingScripts' document.createElement pattern)
 * 'unsafe-inline' is intentionally kept in style-src; CSS injection carries
 * far lower XSS risk than script injection and is required by many third-party
 * widgets.
 */
function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'`
      + ` https://js.stripe.com https://cdn.jsdelivr.net`
      + ` https://www.googletagmanager.com https://www.google-analytics.com`
      + ` https://www.googleadservices.com https://*.doubleclick.net`
      + ` https://connect.facebook.net https://*.posthog.com https://snap.licdn.com`
      + ` https://sc-static.net`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://*.supabase.co`
      + ` https://api.stripe.com https://*.google-analytics.com https://analytics.google.com`
      + ` https://*.analytics.google.com https://www.google.com https://www.googleadservices.com`
      + ` https://*.doubleclick.net https://*.facebook.com https://eu.i.posthog.com`
      + ` https://cdn.jsdelivr.net https://storage.googleapis.com https://px.ads.linkedin.com`
      + ` https://tr.snapchat.com`,
    `frame-src https://js.stripe.com https://hooks.stripe.com https://*.doubleclick.net`,
    `worker-src 'self' blob:`,
    `media-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

// ── Proxy function ────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anonymous';

  // 1. Rate limiting — distributed via Upstash Redis (falls back to in-process
  //    Map in dev when UPSTASH_REDIS_REST_URL is absent).
  const allowed = await checkProxyRateLimit(ip, pathname.startsWith('/api'));
  if (!allowed) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  // Generate a per-request nonce for the Content-Security-Policy.
  // Server components read this via headers().get('x-nonce').
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Forward the nonce to server components via a request header.
  // We build a mutable copy so we can include it even when Supabase
  // reassigns `response` inside the setAll cookie callback below.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  // 2. Supabase session hydration
  //    createServerClient reads and refreshes the auth cookie on every request,
  //    keeping the JWT in sync with the response headers.
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Preserve x-nonce when response is reassigned after cookie refresh
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  // getUser() refreshes the session cookie internally. When the stored refresh
  // token has been revoked or expired Supabase throws AuthApiError. We catch
  // that here so a stale cookie never crashes the proxy for the whole request;
  // the user is simply treated as unauthenticated and redirected to login if
  // they try to access a protected route.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  let staleCookies = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      user = data.user;
    } else if (error.status === 400 && (error as { code?: string }).code === 'refresh_token_not_found') {
      staleCookies = true;
    }
  } catch {
    // AuthApiError thrown (not returned) — treat the same as a stale token.
    staleCookies = true;
  }

  // Clear any stale Supabase session cookies so the browser isn't stuck in a
  // loop of failed refreshes. This eliminates the AuthApiError Sentry noise.
  if (staleCookies) {
    for (const cookie of request.cookies.getAll()) {
      if (
        cookie.name.startsWith('sb-') ||
        cookie.name.includes('-auth-token') ||
        cookie.name === 'supabase-auth-token'
      ) {
        response.cookies.delete(cookie.name);
      }
    }
  }

  // 3. Route classification
  const isAuthRoute       = pathname.startsWith('/auth');
  const isDashboardRoute  = pathname.startsWith('/dashboard');
  const isAdminRoute      = pathname.startsWith('/admin');
  const isPortalRoute     = pathname.startsWith('/portal');
  const isOnboardingRoute = pathname.startsWith('/onboarding');
  const isSlpRoute        = pathname.startsWith('/slp');

  // 4. Auth gates — unauthenticated users bounce to login
  if ((isDashboardRoute || isAdminRoute || isPortalRoute || isOnboardingRoute || isSlpRoute) && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Redirect already-authed users away from auth pages.
  //    Exempt /auth/callback — it must run even when a session cookie exists
  //    (e.g. re-linking a Google account) so the OAuth code exchange completes.
  if (isAuthRoute && user && !pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 6. Admin gate — restrict /admin to users with is_admin = true
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // 7. Onboarding gate — redirect new users to profile setup before dashboard.
  //
  //    Queries the DB on every dashboard visit for authenticated users.
  //    The previous approach used a flowen_ob=1 cookie as a skip-flag, but
  //    httpOnly cookies can still be set via browser DevTools or direct HTTP
  //    requests, allowing a user to bypass onboarding and reach the dashboard
  //    with an incomplete profile (null display_name, etc.).
  //
  //    A single .maybeSingle() on an indexed primary-key column costs ~1ms on
  //    Supabase; the dashboard already issues several DB calls per render, so
  //    this has no measurable impact on page-load latency.
  if (isDashboardRoute && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.onboarding_complete) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
  }

  // 8. Portal identity guard
  //    Only runs for authenticated users on /portal paths.
  if (isPortalRoute && user) {
    const guardRedirect = await applyIdentityGuard(request, supabase as any, user.id);
    if (guardRedirect) return guardRedirect;
  }

  // 9. Analytics — visitor session cookie + UTM attribution
  if (!request.cookies.has(VS_COOKIE)) {
    response.cookies.set(VS_COOKIE, crypto.randomUUID(), {
      path:     '/',
      maxAge:   COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
    });
  }
  const searchParams = request.nextUrl.searchParams;
  const hasUtm = UTM_PARAMS.some(p => searchParams.has(p));
  if (hasUtm) {
    const utm: Record<string, string> = {};
    for (const p of UTM_PARAMS) {
      const v = searchParams.get(p);
      if (v) utm[p] = v;
    }
    response.cookies.set(UTM_COOKIE, JSON.stringify(utm), {
      path:     '/',
      maxAge:   COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  // 10. Marketing attribution — server-side ad click capture
  //
  //     Runs only when the request carries click IDs (gclid, fbclid, …) or
  //     when a brand-new anonymous ID is being minted alongside UTM params.
  //     This prevents a DB write on every page view and limits data collection
  //     to meaningful attribution events.
  //
  //     The flowen_anon_id cookie is the DB primary key. It is:
  //       • HTTP-only  — inaccessible to client-side JS / third-party scripts
  //       • Secure     — HTTPS only in production
  //       • SameSite=Lax — safe for top-level navigations from ad links
  //       • 1-year TTL — survives session closes for cross-session attribution
  {
    const existingAnonId = request.cookies.get(ANON_ATTR_COOKIE)?.value;
    const isNewAnonId    = !existingAnonId;
    const anonId         = existingAnonId ?? crypto.randomUUID();

    // Collect whichever click IDs are present on this request.
    const clickIds: Partial<Record<ClickIdParam, string>> = {};
    for (const param of CLICK_ID_PARAMS) {
      const v = searchParams.get(param);
      if (v) clickIds[param] = v;
    }
    const hasClickIds = Object.keys(clickIds).length > 0;

    // Write to DB when: a click ID just arrived, OR a brand-new visitor also
    // has UTMs (so their organic-with-UTM attribution is captured immediately).
    if (hasClickIds || (isNewAnonId && hasUtm)) {
      const rawIp   = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
      const record  = {
        ...clickIds,
        ...(hasUtm && {
          utm_source:   searchParams.get('utm_source')   ?? undefined,
          utm_medium:   searchParams.get('utm_medium')   ?? undefined,
          utm_campaign: searchParams.get('utm_campaign') ?? undefined,
          utm_content:  searchParams.get('utm_content')  ?? undefined,
          utm_term:     searchParams.get('utm_term')     ?? undefined,
        }),
        referrer:     request.headers.get('referer') ?? undefined,
        landing_page: pathname,
        ip_address:   rawIp ? anonymizeIp(rawIp) : undefined,
        user_agent:   request.headers.get('user-agent') ?? undefined,
      };

      // Fire-and-forget — does not add to response latency.
      void captureAttribution(anonId, record).catch(() => {
        // Swallow silently — attribution failure must never impact page delivery.
      });
    }

    // Set or refresh the anonymous ID cookie whenever it is new or click IDs
    // have arrived (the arrival of a click ID extends the attribution window).
    if (isNewAnonId || hasClickIds) {
      response.cookies.set(ANON_ATTR_COOKIE, anonId, {
        path:     '/',
        maxAge:   ANON_ATTR_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
        secure:   process.env.NODE_ENV === 'production',
      });
    }
  }

  // 11. Affiliate referral tracking
  //
  //     Detects ?ref=CODE on any public URL, sets a 30-day httpOnly cookie
  //     (flowen_ref), and fire-and-forgets a click record into affiliate_clicks.
  //     The cookie is later read server-side at signup / subscription to create
  //     a conversion and commission record.
  //
  //     Attribution model: last-touch — a new ?ref= param overwrites the existing
  //     cookie so the most-recent referrer receives credit.
  applyAffiliateReferral(request, response);

  // 12. Content-Security-Policy — nonce-based, generated per request.
  //     The pitch deck route (/api/pitch/*) intentionally uses its own permissive
  //     CSP defined in next.config.ts (Tailwind CDN, FontAwesome, unsafe-inline);
  //     next.config.ts route-level headers override proxy headers for that path,
  //     so we still set it here — the config override wins safely.
  response.headers.set('Content-Security-Policy', buildCsp(nonce));

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
