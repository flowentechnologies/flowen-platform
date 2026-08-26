// Server component — reads auth state before first paint so the client navbar
// never flickers between "Sign In" and "Dashboard →".
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import MarketingNavbarClient from './MarketingNavbarClient';

export default async function MarketingNavbar() {
  let initialLoggedIn = false;
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    initialLoggedIn = !!user;
  } catch {
    // Render as logged-out if auth check fails — safe fallback.
  }

  return <MarketingNavbarClient initialLoggedIn={initialLoggedIn} />;
}
