import { assertAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import FeedbackClient from './FeedbackClient';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function FeedbackPage() {
  await assertAdmin();

  const { data } = await db()
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight mb-1">Feedback</h1>
      <p className="text-sm text-slate-500 mb-8">In-app feedback submitted by users.</p>
      <FeedbackClient initialFeedback={data ?? []} />
    </div>
  );
}
