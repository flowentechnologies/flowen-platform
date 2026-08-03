import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

const VS_COOKIE = '__vs';

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

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
        // Mark visitor session as converted
        (async () => {
          const vsId = cookieStore.get(VS_COOKIE)?.value;
          if (vsId) {
            await serviceDb()
              .from('visitor_sessions')
              .update({ converted: true, user_id: session.user.id })
              .eq('id', vsId);
          }
        })(),
      ]);

      const profile = profileRes.data;
      let redirectTo: string;
      if (profile?.is_admin) {
        redirectTo = '/admin';
      } else if (!profile?.onboarding_complete) {
        redirectTo = '/onboarding';
      } else {
        redirectTo = '/dashboard';
      }
      return NextResponse.redirect(new URL(redirectTo, origin));
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
