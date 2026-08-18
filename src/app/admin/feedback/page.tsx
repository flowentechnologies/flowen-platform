import { assertAdmin } from '@/lib/admin/guard';
import FeedbackClient from './FeedbackClient';
import { adminDb as db } from '@/lib/supabase/admin';

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
