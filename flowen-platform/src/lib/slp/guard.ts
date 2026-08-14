import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface SlpUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  is_admin: boolean;
}

/** Resolves the current user if they are an SLT or admin, otherwise redirects. */
export async function assertSlp(): Promise<SlpUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin, display_name')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'slp' && !profile.is_admin)) {
    redirect('/dashboard');
  }

  return {
    id:          user.id,
    email:       user.email ?? '',
    displayName: profile.display_name ?? '',
    role:        profile.role,
    is_admin:    profile.is_admin,
  };
}
