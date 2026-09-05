'use client';

import { useState, useEffect, useCallback } from 'react';

interface CheckRow {
  id: string;
  check_type: 'billing' | 'marketing' | 'venture';
  status: 'ok' | 'discrepancy' | 'error';
  summary: string;
  details: Record<string, unknown>;
  checked_at: string;
}

const CHECK_LABEL: Record<string, string> = {
  billing: 'Billing — Stripe vs Flowen',
  marketing: 'Marketing — ad platforms vs real signups',
  venture: 'Venture — compliance docs vs live numbers',
};

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  discrepancy: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  error: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

const STATUS_ICON: Record<string, string> = { ok: '✓', discrepancy: '⚠️', error: '✕' };

export function ConsistencyClient() {
  const [latest, setLatest] = useState<Record<string, CheckRow>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const fetchChecks = useCallback(async () => {
    const res = await fetch('/api/admin/consistency');
    if (!res.ok) return;
    const data = await res.json() as { latest: Record<string, CheckRow> };
    setLatest(data.latest);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchChecks().finally(() => setLoading(false));
  }, [fetchChecks]);

  async function triggerJob(jobId: string) {
    const res = await fetch('/api/admin/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger_job', jobId }),
    });
    const data = await res.json() as { run?: { status: string; error?: string | null } };
    return data.run?.status === 'success';
  }

  async function runAll() {
    setRunning(true);
    setRunMessage('Syncing Meta Ads…');
    await triggerJob('marketing-sync-meta');
    setRunMessage('Syncing Google Ads…');
    await triggerJob('marketing-sync-google');
    setRunMessage('Running consistency checks…');
    const ok = await triggerJob('consistency-check');
    setRunMessage(ok ? 'Done.' : 'Consistency check run failed — see /admin/cron for details.');
    await fetchChecks();
    setRunning(false);
  }

  const types: CheckRow['check_type'][] = ['billing', 'marketing', 'venture'];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Consistency Checks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Cross-system checks, run daily: Stripe vs Flowen&apos;s own billing records, ad platforms vs real signups,
            and generated compliance documents vs live venture numbers. Discrepancies are flagged here and in the
            notification bell — nothing is ever auto-corrected, since some of these genuinely need a human decision.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={runAll}
            disabled={running}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {running ? 'Running…' : 'Run all checks now'}
          </button>
          {runMessage && <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs text-right">{runMessage}</p>}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {types.map(type => {
            const row = latest[type];
            return (
              <div key={type} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{CHECK_LABEL[type]}</p>
                  {row ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[row.status]}`}>
                      {STATUS_ICON[row.status]} {row.status}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-400">
                      never run
                    </span>
                  )}
                </div>
                {row ? (
                  <>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{row.summary}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Checked {new Date(row.checked_at).toLocaleString('en-GB')}
                    </p>
                    {Object.keys(row.details).length > 0 && (
                      <pre className="mt-2 text-[10px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-500 dark:text-slate-400">
                        {JSON.stringify(row.details, null, 2)}
                      </pre>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Click &quot;Run all checks now&quot; to get a first result.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
