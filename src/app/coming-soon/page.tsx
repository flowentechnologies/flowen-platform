import type { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ComingSoonClient from './ComingSoonClient';

/**
 * /coming-soon is the "you signed up, but early access hasn't been granted
 * yet" gate — the ONLY place in the codebase that redirects here is
 * dashboard/layout.tsx, for an authenticated user without early_access/admin.
 *
 * It was previously reachable directly by anyone, logged in or not — a plain
 * public page with no auth check of its own. Next.js doesn't gate a route
 * just because something else redirects to it; visiting the URL by hand
 * skipped that check entirely and rendered the same "you're waitlisted"
 * messaging to every anonymous visitor. Mirrors dashboard/layout.tsx's own
 * check so the two can never drift out of sync:
 *   - No session at all           -> /auth/login (nothing to gate — sign in first)
 *   - Already has access          -> /dashboard  (self-heals a stale bookmark
 *                                     or an email link sent before access
 *                                     was granted)
 *   - Authenticated, no access    -> render the real waiting-room page
 */
export const metadata: Metadata = {
  title: 'Coming Soon | Flowen',
  robots: { index: false, follow: false },
};

async function getGateState() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authed: false as const };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, early_access')
    .eq('id', user.id)
    .single();

  return {
    authed: true as const,
    hasAccess: (profile?.is_admin ?? false) || (profile?.early_access ?? false),
  };
}

export default async function ComingSoonPage() {
  const gate = await getGateState();

  if (!gate.authed) redirect('/auth/login');
  if (gate.hasAccess) redirect('/dashboard');

  return <ComingSoonClient />;
}
