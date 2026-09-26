import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { SafeguardingClient } from './SafeguardingClient';

export const dynamic = 'force-dynamic';

export interface SafeguardingConcernRow {
  id: string;
  raised_by: string | null;
  patient_user_id: string | null;
  category: string;
  description: string;
  status: string;
  escalated_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export default async function SafeguardingPage() {
  await assertAdmin();

  const { data } = await adminDb()
    .from('safeguarding_concerns')
    .select('*')
    .order('created_at', { ascending: false });

  const items = (data ?? []) as SafeguardingConcernRow[];
  const open = items.filter(i => i.status === 'open' || i.status === 'escalated').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Safeguarding</h1>
          <p className="text-slate-400 text-sm mt-1">
            Concern log — see the <a href="/legal" className="underline hover:text-slate-300">Safeguarding Policy</a> for the escalation process this feeds into.
          </p>
        </div>
        <span className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
          open > 0 ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        }`}>
          {open} OPEN
        </span>
      </div>

      <SafeguardingClient initialItems={items} />
    </div>
  );
}
