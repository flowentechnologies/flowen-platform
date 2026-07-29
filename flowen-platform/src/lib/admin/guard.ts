import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  email: string | undefined;
  is_admin: boolean;
}

export async function requireAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) return null;

  return {
    id: user.id,
    email: user.email,
    is_admin: true,
  };
}

export async function assertAdmin(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/dashboard');
  }
  return admin;
}
