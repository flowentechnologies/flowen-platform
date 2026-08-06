import type { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardNav, MobileBottomNav, type UserProfile } from '@/components/dashboard/DashboardNav';
import FeedbackWidget from '@/components/dashboard/FeedbackWidget';

export const metadata: Metadata = {
  title: 'Dashboard | Flowen',
  robots: { index: false, follow: false },
};

async function getProfileData(userId: string) {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, tier, is_admin, role, early_access')
    .eq('id', userId)
    .single();

  return profile;
}

async function getAuthUser() {
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
  return user;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getAuthUser();
  if (!authUser) redirect('/auth/login');

  const profile = await getProfileData(authUser.id);
  const isAdmin = profile?.is_admin ?? false;
  const earlyAccess = profile?.early_access ?? false;
  if (!isAdmin && !earlyAccess) redirect('/coming-soon');

  const user: UserProfile = {
    email:       authUser.email ?? '',
    displayName: profile?.display_name ?? null,
    tier:        profile?.tier ?? null,
    isAdmin,
    role:        profile?.role ?? null,
  };

  return (
    <>
      <DashboardNav user={user} />
      <main className="pt-16 pb-16 sm:pb-0 min-h-screen bg-slate-950">
        {children}
      </main>
      <MobileBottomNav user={user} />
      <FeedbackWidget />
    </>
  );
}
