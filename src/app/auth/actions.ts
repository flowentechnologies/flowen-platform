"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { bridgeAttribution } from "@/lib/attribution";

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
  revalidatePath("/", "layout");
  redirect("/auth/login");
}
