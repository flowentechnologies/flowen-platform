import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { bridgeAttribution } from '@/lib/attribution';
import { recordMilestone } from '@/lib/analytics/milestones';
import { adminDb } from '@/lib/supabase/admin';
import { SESSION_STARTED_COOKIE, sessionStartedCookieOptions } from '@/lib/auth/session-policy';

const VS_COOKIE = '__vs';

const serviceDb = adminDb;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/dashboard';
  // Only allow relative paths — prevent open redirect to external URLs
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

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
      // Authoritative signup milestone (2026-09-29). recordMilestone inserts
      // once per user and returns the new row's id only on first insert, so
      // the signup conversion fires exactly once — repeated callbacks,
      // OAuth re-links and magic-link re-logins all no-op. The 7-day
      // created_at window covers email confirmations that arrive days after
      // the signup request while excluding long-existing accounts from a
      // one-time backfill fire when this ships.
      const accountAgeMs = Date.now() - new Date(session.user.created_at).getTime();
      let signupEventId: string | null = null;
      if (accountAgeMs >= 0 && accountAgeMs < 7 * 24 * 60 * 60 * 1000) {
        const milestone = await recordMilestone(session.user.id, 'signup', session.user.id);
        signupEventId = milestone.id;
      }

      const [profileRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_admin, onboarding_complete')
          .eq('id', session.user.id)
          .single(),
        // Mark visitor session as converted (existing analytics system).
        (async () => {
          const vsId = cookieStore.get(VS_COOKIE)?.value;
          if (vsId) {
            await serviceDb()
              .from('visitor_sessions')
              .update({ converted: true, user_id: session.user.id })
              .eq('id', vsId);
          }
        })(),
        // Bridge marketing attribution — links the flowen_anon_id cookie to
        // the newly authenticated user, triggering the Meta CAPI DB webhook.
        // Only for a verified NEW signup (milestone inserted by this
        // request); a returning user must never fire a signup conversion.
        signupEventId
          ? bridgeAttribution(
              cookieStore.get('flowen_anon_id')?.value,
              session.user.id,
              'signup',
              signupEventId,
            )
          : Promise.resolve(),
      ]);

      const profile = profileRes.data;
      let redirectTo: string;
      if (profile?.is_admin) {
        // Admins always land on admin — don't honour next for security
        redirectTo = '/admin';
      } else if (!profile?.onboarding_complete) {
        // New / incomplete user: must complete onboarding first.
        // Thread `next` through so the final step can redirect there afterwards.
        redirectTo = next !== '/dashboard'
          ? `/onboarding?next=${encodeURIComponent(next)}`
          : '/onboarding';
      } else {
        // Returning user: honour the `next` param (already validated as relative).
        redirectTo = next;
      }
      // Marks the start of the absolute session lifetime — see login() in
      // auth/actions.ts for why this is set independently at every place a
      // session can begin (password login, magic link, and OAuth all land here).
      response.cookies.set(SESSION_STARTED_COOKIE, String(Date.now()), sessionStartedCookieOptions());

      if (signupEventId) {
        // One-shot browser flag: PostHogProvider reads this, fires the
        // consented GA4 sign_up + Meta CompleteRegistration with this exact
        // event ID (shared with the server CAPI send for dedup), then
        // clears it. Not httpOnly — the browser must read it; 10-minute TTL.
        response.cookies.set('flowen_signup_event', signupEventId, {
          path: '/',
          maxAge: 600,
          httpOnly: false,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
      }

      // Mutate the Location header on the existing `response` so the session
      // cookies Supabase wrote into it are preserved on the redirect.
      response.headers.set('Location', new URL(redirectTo, origin).toString());
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
