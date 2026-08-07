// Next.js 16 proxy entry point — supersedes src/middleware.ts (deprecated convention).
// Run `npx @next/codemod@canary middleware-to-proxy .` to apply the official rename codemod.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applyIdentityGuard } from '@/middleware/identity-guard';
import { applyAffiliateReferral } from '@/middleware/affiliate-referral';

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

// ── In-process rate limiter ───────────────────────────────────────────────────
// In-memory map, scoped to the serverless instance lifetime.
// For a distributed rate limit (multi-region), replace with Upstash Redis
// using @upstash/ratelimit — the dependency is already present.

const ipCache = new Map<string, { count: number; reset: number }>();

const RATE_LIMIT_API  = 60;   // requests / minute for /api paths
const RATE_LIMIT_PAGE = 120;  // requests / minute for all other paths
const WINDOW_MS       = 60_000;

function checkRateLimit(ip: string, isApi: boolean): boolean {
  const now   = Date.now();
  const limit = isApi ? RATE_LIMIT_API : RATE_LIMIT_PAGE;
  const rec   = ipCache.get(ip) ?? { count: 0, reset: now + WINDOW_MS };

  if (now > rec.reset) {
    rec.count = 0;
    rec.reset = now + WINDOW_MS;
  }
  rec.count += 1;
  ipCache.set(ip, rec);

  return rec.count <= limit;
}

// ── Proxy function ────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anonymous';

  // 1. Rate limiting
  if (!checkRateLimit(ip, pathname.startsWith('/api'))) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  // 2. Supabase session hydration
  //    createServerClient reads and refreshes the auth cookie on every request,
  //    keeping the JWT in sync with the response headers.
  let response = NextResponse.next({ request: { headers: request.headers } });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 3. Route classification
  const isAuthRoute       = pathname.startsWith('/auth');
  const isDashboardRoute  = pathname.startsWith('/dashboard');
  const isAdminRoute      = pathname.startsWith('/admin');
  const isPortalRoute     = pathname.startsWith('/portal');
  const isOnboardingRoute = pathname.startsWith('/onboarding');

  // 4. Auth gates — unauthenticated users bounce to login
  if ((isDashboardRoute || isAdminRoute || isPortalRoute || isOnboardingRoute) && !user) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Redirect already-authed users away from auth pages
  if (isAuthRoute && user) {
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

  // 7. Onboarding gate — redirect new users to profile setup on first dashboard visit.
  //    Uses a cookie (flowen_ob) so the DB is only queried once per device.
  if (isDashboardRoute && user && !request.cookies.get('flowen_ob')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && !profile.onboarding_complete) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    // Mark as checked — set a 1-year cookie so we skip this query on future visits.
    const next = NextResponse.next({ request });
    next.cookies.set('flowen_ob', '1', {
      path:     '/',
      maxAge:   60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
    });
    return next;
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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
