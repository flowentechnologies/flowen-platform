import { assertAdmin } from '@/lib/admin/guard';
import { CronClient } from './CronClient';
import { adminDb } from '@/lib/supabase/admin';

// ── DB client ─────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

export type CronRunStatus = 'running' | 'success' | 'failed' | 'skipped';

export interface CronRun {
  id: string;
  job_id: string;
  status: CronRunStatus;
  triggered_by: string;
  duration_ms: number | null;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CronPage() {
  const admin = await assertAdmin();

  const db = adminDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [allRunsRes, failed7dRes] = await Promise.all([
    db
      .from('cron_runs')
      .select('id,job_id,status,triggered_by,duration_ms,result,error,started_at,finished_at')
      .order('started_at', { ascending: false })
      .limit(200),
    db
      .from('cron_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('started_at', sevenDaysAgo),
  ]);

  const allRuns    = (allRunsRes.data ?? []) as CronRun[];
  const failed7d   = failed7dRes.count ?? 0;
  const lastRun    = allRuns[0] ?? null;

  const generatedAt = new Date().toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Cron</h1>
          <p className="text-slate-400 text-sm mt-1">Scheduled jobs · Manual triggers · Run history</p>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:block">{generatedAt} (London)</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Total Jobs</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">5</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Last Run</p>
          <p className={`text-2xl font-black ${lastRun ? 'text-slate-900 dark:text-white' : 'text-slate-600'}`}>
            {lastRun
              ? new Date(lastRun.started_at).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })
              : '—'}
          </p>
          {lastRun && (
            <p className="text-[10px] font-mono text-slate-500 mt-1">{lastRun.job_id}</p>
          )}
        </div>
        <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 ${failed7d > 0 ? 'border-red-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Failed (7d)</p>
          <p className={`text-4xl font-black ${failed7d > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{failed7d}</p>
        </div>
      </div>

      {/* Client-rendered cron job list */}
      <CronClient initialRuns={allRuns} adminEmail={admin.email ?? 'admin'} />

    </div>
  );
}
