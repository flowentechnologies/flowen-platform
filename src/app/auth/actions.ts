"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { bridgeAttribution } from "@/lib/attribution";
import { SESSION_STARTED_COOKIE, sessionStartedCookieOptions } from "@/lib/auth/session-policy";

async function getSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Invoked from Server Component context
          }
        },
      },
    }
  );
}

export async function login(formData: FormData) {
  const supabase = await getSupabaseClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: authData, error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  const [{ data: profile }, cookieStore] = await Promise.all([
    supabase.from('profiles').select('is_admin, onboarding_complete').eq('id', authData.user.id).single(),
    cookies(),
  ]);

  // Bridge the anonymous attribution record to this user on every login.
  // No-ops gracefully if the cookie is absent or no ad click is on record.
  const anonId = cookieStore.get('flowen_anon_id')?.value;
  await bridgeAttribution(anonId, authData.user.id, 'signup');

  // Marks the start of the absolute session lifetime — proxy.ts forces
  // re-login once this cookie is older than MAX_SESSION_AGE_MS, independent
  // of the idle timeout and independent of how many times the access token
  // itself gets silently refreshed in between.
  cookieStore.set(SESSION_STARTED_COOKIE, String(Date.now()), sessionStartedCookieOptions());

  revalidatePath("/", "layout");
  if (profile?.is_admin) redirect("/admin");
  else if (!profile?.onboarding_complete) redirect("/onboarding");
  else redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await getSupabaseClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const brand = (formData.get("brand") as string) || "flowen";
  const tier = (formData.get("tier") as string) || "standard";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        brand,
        tier,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.flowen.digital"}/auth/callback`,
    },
  });

  if (error) {
    return redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/auth/login?message=check_email");
}

export async function logout() {
  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SESSION_STARTED_COOKIE);
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

/**
 * Same sign-out as logout(), but for the cases where *why* matters enough to
 * tell the user: IdleTimeoutGuard calling this directly (not via a form, so
 * logout()'s implicit FormData argument isn't available here) after 15
 * minutes of inactivity, or proxy.ts redirecting here after the 7-day
 * absolute session cap is hit. Login page reads `message` to show which.
 */
export async function logoutForReason(reason: 'idle' | 'session_expired') {
  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
  (await cookies()).delete(SESSION_STARTED_COOKIE);
  revalidatePath("/", "layout");
  redirect(`/auth/login?message=${reason === 'idle' ? 'signed_out_idle' : 'session_expired'}`);
}
