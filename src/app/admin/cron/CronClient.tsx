'use client';

import React, { useState, useTransition } from 'react';
import type { CronRun, CronRunStatus } from './page';

// ── Job definitions (hardcoded) ───────────────────────────────────────────────

interface CronJobDef {
  id: string;
  label: string;
  description: string;
  schedule: string;
  apiPath: string;
}

const CRON_JOBS: CronJobDef[] = [
  {
    id:          'subscription-sync',
    label:       'Subscription Sync',
    description: 'Sync Stripe subscription statuses',
    schedule:    'Daily 02:00',
    apiPath:     '/api/cron/subscription-sync',
  },
  {
    id:          'data-retention',
    label:       'Data Retention',
    description: 'Apply data retention policies',
    schedule:    'Weekly Sun 03:00',
    apiPath:     '/api/cron/data-retention',
  },
  {
    id:          'system-health',
    label:       'System Health',
    description: 'Ping all services, log health status',
    schedule:    'Hourly',
    apiPath:     '/api/cron/system-health',
  },
  {
    id:          'gdpr-sweep',
    label:       'GDPR Sweep',
    description: 'Flag overdue GDPR requests (>25 days)',
    schedule:    'Daily 09:00',
    apiPath:     '/api/cron/gdpr-sweep',
  },
  {
    id:          'audit-archive',
    label:       'Audit Archive',
    description: 'Archive audit logs older than 90 days',
    schedule:    'Weekly Sun 04:00',
    apiPath:     '/api/cron/audit-archive',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDuration(ms: number | null) {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_CFG: Record<CronRunStatus, { dot: string; badge: string; label: string }> = {
  running: { dot: 'bg-blue-400 animate-pulse',   badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',     label: 'Running'  },
  success: { dot: 'bg-emerald-400',               badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'Success' },
  failed:  { dot: 'bg-red-400 animate-pulse',     badge: 'bg-red-500/10 text-red-400 border-red-500/30',        label: 'Failed'   },
  skipped: { dot: 'bg-slate-500',                 badge: 'bg-slate-700/50 text-slate-400 border-slate-600/30',  label: 'Skipped'  },
};

// ── Run history panel ─────────────────────────────────────────────────────────

function RunHistory({ runs }: { runs: CronRun[] }) {
  if (runs.length === 0) {
    return <p className="py-4 text-xs text-slate-600 font-mono text-center">No runs recorded yet</p>;
  }

  const successCount = runs.filter(r => r.status === 'success').length;
  const rate         = runs.length > 0 ? Math.round((successCount / runs.length) * 100) : 0;

  return (
    <div className="mt-4 space-y-3">
      {/* Success rate bar */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-slate-500 w-24">Success rate</span>
        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${rate}%` }}
          />
        </div>
        <span className={`text-[10px] font-mono w-8 text-right ${rate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {rate}%
        </span>
      </div>

      {/* Run list */}
      <div className="bg-slate-800/50 rounded-xl overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-300 dark:border-slate-700">
              <th className="text-left px-3 py-2 font-mono text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-3 py-2 font-mono text-slate-500 uppercase tracking-wide hidden sm:table-cell">Duration</th>
              <th className="text-left px-3 py-2 font-mono text-slate-500 uppercase tracking-wide hidden md:table-cell">Triggered by</th>
              <th className="text-left px-3 py-2 font-mono text-slate-500 uppercase tracking-wide">Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.slice(0, 10).map(run => {
              const cfg = STATUS_CFG[run.status];
              return (
                <tr key={run.id} className="border-b border-slate-700/50 last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    {run.error && (
                      <p className="text-[9px] text-red-400 font-mono mt-0.5 truncate max-w-[180px]">{run.error}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell font-mono text-slate-400">
                    {fmtDuration(run.duration_ms)}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell font-mono text-slate-500 truncate max-w-[140px]">
                    {run.triggered_by}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">
                    {fmtDate(run.started_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({
  job,
  runs,
  onTrigger,
  adminEmail,
}: {
  job: CronJobDef;
  runs: CronRun[];
  onTrigger: (jobId: string, run: CronRun) => void;
  adminEmail: string;
}) {
  const [expanded, setExpanded]  = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [, start]                = useTransition();

  const lastRun = runs[0] ?? null;
  const lastCfg = lastRun ? STATUS_CFG[lastRun.status] : null;

  async function trigger() {
    setTriggering(true);
    setTriggerError(null);
    start(async () => {
      try {
        const res = await fetch('/api/admin/cron', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'trigger_job', jobId: job.id, adminEmail }),
        });
        const data = await res.json() as { run?: CronRun; error?: string };
        if (data.error) {
          setTriggerError(data.error);
        } else if (data.run) {
          onTrigger(job.id, data.run);
        }
      } catch (err) {
        setTriggerError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setTriggering(false);
      }
    });
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 flex items-start gap-4">
        {/* Status dot */}
        <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${lastCfg ? lastCfg.dot : 'bg-slate-700'}`} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-slate-900 dark:text-white">{job.label}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400">
              {job.schedule}
            </span>
            {lastCfg && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${lastCfg.badge}`}>
                {lastCfg.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{job.description}</p>
          {lastRun && (
            <p className="text-[10px] font-mono text-slate-600 mt-1">
              Last: {fmtDate(lastRun.started_at)}
              {lastRun.duration_ms !== null && ` · ${fmtDuration(lastRun.duration_ms)}`}
            </p>
          )}
          {triggerError && (
            <p className="text-[10px] font-mono text-red-400 mt-1">{triggerError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={trigger}
            disabled={triggering}
            className="px-3 py-1.5 text-[11px] font-mono rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40"
          >
            {triggering ? 'Running…' : 'Run Now'}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {expanded ? 'Hide' : `History (${runs.length})`}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-200 dark:border-slate-800 pt-4">
          <RunHistory runs={runs} />
        </div>
      )}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface Props {
  initialRuns: CronRun[];
  adminEmail:  string;
}

export function CronClient({ initialRuns, adminEmail }: Props) {
  const [runs, setRuns] = useState<CronRun[]>(initialRuns);

  function handleTrigger(jobId: string, newRun: CronRun) {
    setRuns(prev => [newRun, ...prev.filter(r => !(r.job_id === jobId && r.id === newRun.id))]);
  }

  function runsForJob(jobId: string) {
    return runs.filter(r => r.job_id === jobId);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">Scheduled Jobs</h2>
      {CRON_JOBS.map(job => (
        <JobCard
          key={job.id}
          job={job}
          runs={runsForJob(job.id)}
          onTrigger={handleTrigger}
          adminEmail={adminEmail}
        />
      ))}
    </div>
  );
}
