import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { finalizeSignIn } from '@/lib/auth/post-sign-in';
import { isSameOrigin, parseVerifyCodeBody } from '@/lib/auth/email-code';

/**
 * Verifies the 6-digit email code from a signInWithOtp email. The code is
 * checked against the email address, so unlike the magic link it does not
 * depend on the PKCE verifier stored in the browser that requested it - the
 * user can read the email in any app (Gmail in-app browser, another device)
 * and type the code into the page that is waiting.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request.headers.get('origin'), request.nextUrl.origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const input = parseVerifyCodeBody(body);
  if (!input) {
    return NextResponse.json({ error: 'Enter the 6-digit code from your email.' }, { status: 400 });
  }

  const cookieStore = request.cookies;
  const holder = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => holder.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.verifyOtp({ email: input.email, token: input.token, type: 'email' });
  if (error || !data.session) {
    return NextResponse.json(
      { error: 'That code is incorrect or has expired. Check the latest email or request a new code.' },
      { status: 401 },
    );
  }

  const redirectTo = await finalizeSignIn({
    cookieStore, response: holder, supabase, session: data.session, next: input.next,
  });
  const response = NextResponse.json({ redirectTo });
  holder.cookies.getAll().forEach(c => response.cookies.set(c));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
