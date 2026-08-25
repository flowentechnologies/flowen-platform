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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
          <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        <div>
          <h2 className="text-slate-900 dark:text-white font-semibold text-base">No clinician assigned yet</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto leading-relaxed">
            Once a Speech &amp; Language Therapist is linked to your account, your conversation with them will appear here.
          </p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-600">
          Need an SLP? <a href="/dashboard/support" className="text-emerald-500 hover:text-emerald-400 transition-colors">Contact support</a> to be matched with a clinician.
        </p>
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
