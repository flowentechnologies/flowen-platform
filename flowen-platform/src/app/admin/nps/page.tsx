import { assertAdmin } from '@/lib/admin/guard';
import NpsClient from './NpsClient';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function NpsPage() {
  await assertAdmin();

  const { data: rows } = await db()
    .from('nps_responses')
    .select('*')
    .order('created_at', { ascending: false });

  const responses  = rows ?? [];
  const responded  = responses.filter(r => r.score !== null);
  const total      = responded.length;
  const promoters  = responded.filter(r => r.score >= 9).length;
  const detractors = responded.filter(r => r.score <= 6).length;
  const npsScore   = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;
  const avgScore   = total > 0
    ? Math.round((responded.reduce((s: number, r: { score: number }) => s + r.score, 0) / total) * 10) / 10
    : null;
  const dist = Array.from({ length: 11 }, (_, i) => ({
    score: i,
    count: responded.filter(r => r.score === i).length,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight mb-1">NPS</h1>
      <p className="text-sm text-slate-500 mb-8">Net Promoter Score — survey responses and trends.</p>
      <NpsClient
        initialResponses={responses}
        initialStats={{ total, promoters, detractors, passives: total - promoters - detractors, npsScore, avgScore, dist }}
      />
    </div>
  );
}
