import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardNav, type UserProfile } from '@/components/dashboard/DashboardNav';

async function getUserProfile(): Promise<UserProfile | null> {
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
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, tier, is_admin')
    .eq('id', user.id)
    .single();

  return {
    email:       user.email ?? '',
    displayName: profile?.display_name ?? null,
    tier:        profile?.tier ?? null,
    isAdmin:     profile?.is_admin ?? false,
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserProfile();
  if (!user) redirect('/auth/login');

  return (
    <>
      <DashboardNav user={user} />
      <main className="pt-16 min-h-screen bg-slate-950">
        {children}
      </main>
    </>
  );
}
