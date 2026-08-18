import { assertAdmin } from '@/lib/admin/guard';
import { GdprClient } from './GdprClient';
import Link from 'next/link';
import { adminDb } from '@/lib/supabase/admin';

export default async function GdprRequestsPage() {
  await assertAdmin();

  const db = adminDb();
  const { data: requests } = await db
    .from('gdpr_requests')
    .select('*')
    .order('created_at', { ascending: false });

  const all = requests ?? [];
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const pending        = all.filter(r => r.status === 'pending').length;
  const overdue        = all.filter(r => !['completed', 'rejected'].includes(r.status) && new Date(r.sla_due_at) < now).length;
  const completedMonth = all.filter(r => r.status === 'completed' && r.completed_at && r.completed_at >= thisMonthStart).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="mb-1">
            <Link href="/admin/tickets" className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors">← Tickets</Link>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">GDPR Requests</h1>
          <p className="text-slate-400 text-sm mt-1">Art. 15 Access · Art. 16 Rectification · Art. 17 Erasure · Art. 18 Restriction · Art. 20 Portability</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
          UK GDPR
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`border rounded-2xl p-5 ${pending > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Pending</p>
          <p className={`text-4xl font-black ${pending > 0 ? 'text-amber-400' : 'text-slate-900 dark:text-white'}`}>{pending}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">awaiting acknowledgement</p>
        </div>
        <div className={`border rounded-2xl p-5 ${overdue > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Overdue (30-day SLA)</p>
          <p className={`text-4xl font-black ${overdue > 0 ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}>{overdue}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">past ICO deadline</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Completed This Month</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{completedMonth}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{all.filter(r => r.status === 'completed').length} total</p>
        </div>
      </div>

      {/* Guidance */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4">
        <p className="text-xs text-slate-400 leading-relaxed font-mono">
          <span className="text-slate-600 dark:text-slate-300 font-bold">UK GDPR timelines:</span>{' '}
          Acknowledge within <span className="text-slate-900 dark:text-white">72h</span> ·
          Respond within <span className="text-slate-900 dark:text-white">30 days</span> (extendable to 90 days for complex requests with written notice) ·
          Erasure permanently anonymises PII and deletes account — irreversible ·
          ICO complaints portal: <span className="text-indigo-400">ico.org.uk</span>
        </p>
      </div>

      {/* Board */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <GdprClient initialRequests={all} />
      </div>
    </div>
  );
}
