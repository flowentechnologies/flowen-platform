import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_STARTED_COOKIE, sessionStartedCookieOptions } from '@/lib/auth/session-policy';
import { finalizeSignIn } from '@/lib/auth/post-sign-in';

import { safeRedirectPath, isPasswordRecoveryPath } from '@/lib/auth/redirect-path';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  // Only allow relative paths — prevent open redirect to external URLs
  const recovery = isPasswordRecoveryPath(rawNext);
  const next = recovery ? rawNext : safeRedirectPath(rawNext);

  if (code) {
    const cookieStore = request.cookies;
    let response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && session) {
      // A recovery link establishes the session needed by updateUser().
      // Do not turn it into a signup/login milestone or a role redirect.
      if (recovery) {
        response.cookies.set(SESSION_STARTED_COOKIE, String(Date.now()), sessionStartedCookieOptions());
        return response;
      }
      const redirectTo = await finalizeSignIn({ cookieStore, response, supabase, session, next });

      // Mutate the Location header on the existing `response` so the session
      // cookies Supabase wrote into it are preserved on the redirect.
      response.headers.set('Location', new URL(redirectTo, origin).toString());
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
