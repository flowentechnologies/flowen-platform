// Next.js 16 proxy entry point — supersedes src/middleware.ts (deprecated convention).
// Run `npx @next/codemod@canary middleware-to-proxy .` to apply the official rename codemod.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { applyIdentityGuard } from '@/middleware/identity-guard';

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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
