import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertAdmin } from '@/lib/admin/guard';
import AdminShell, { type AdminUser } from '@/components/admin/AdminShell';

async function getAdminUser(): Promise<AdminUser> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('display_name, tier').eq('id', user.id).single()
    : { data: null };
  return {
    email:       user?.email ?? '',
    displayName: profile?.display_name ?? null,
    tier:        profile?.tier ?? null,
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await assertAdmin();
  const user = await getAdminUser();
  return <AdminShell user={user}>{children}</AdminShell>;
}
