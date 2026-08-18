import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MessagesClient } from './MessagesClient';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function MessagesPage() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await ssr.auth.getUser();
  if (!user) redirect('/auth/login');

  const admin = db();

  // Find the assigned SLP for this patient
  const { data: assignment } = await admin
    .from('slp_assignments')
    .select('slp_user_id')
    .eq('patient_user_id', user.id)
    .maybeSingle();

  if (!assignment) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-slate-400 text-sm">No clinician assigned yet. Once a speech-language pathologist is assigned to you, you can message them here.</p>
      </div>
    );
  }

  const { data: slpProfile } = await admin
    .from('profiles')
    .select('id, display_name, email')
    .eq('id', assignment.slp_user_id)
    .single();

  const slpName = slpProfile?.display_name ?? slpProfile?.email?.split('@')[0] ?? 'Your clinician';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Messages</h1>
      <MessagesClient slpId={assignment.slp_user_id} slpName={slpName} myId={user.id} />
    </div>
  );
}
