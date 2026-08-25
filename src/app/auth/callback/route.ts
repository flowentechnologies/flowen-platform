import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { bridgeAttribution } from '@/lib/attribution';
import { adminDb } from '@/lib/supabase/admin';

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
        // Bridge marketing attribution — links the flowen_anon_id cookie to the
        // newly authenticated user, triggering the Meta CAPI DB webhook.
        bridgeAttribution(
          cookieStore.get('flowen_anon_id')?.value,
          session.user.id,
          'signup',
        ),
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
      // Mutate the Location header on the existing `response` so the session
      // cookies Supabase wrote into it are preserved on the redirect.
      response.headers.set('Location', new URL(redirectTo, origin).toString());
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
