"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

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

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/app");
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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://flowen.app"}/auth/callback`,
    },
  });

  if (error) {
    return redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/auth/verify");
}

export async function logout() {
  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}
