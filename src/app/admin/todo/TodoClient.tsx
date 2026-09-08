'use client';

import { useState, useTransition } from 'react';
import type { FailingJob, FlaggedPullRequest } from '@/lib/admin/todo';
import { toggleActionItem, createActionItem, deleteActionItem } from '@/app/actions/todo-actions';

export interface ActionItem {
  id:          string;
  title:       string;
  description: string | null;
  category:    string;
  status:      'open' | 'done';
  created_at:  string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  integration: 'Integration',
  security:    'Security',
  billing:     'Billing',
  general:     'General',
};

const CATEGORY_COLOR: Record<string, string> = {
  integration: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  security:    'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  billing:     'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  general:     'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${className}`}>
      {label}
    </span>
  );
}

function SectionHeader({ title, count, tone }: { title: string; count: number; tone: 'red' | 'amber' | 'slate' }) {
  const dot = { red: 'bg-red-500', amber: 'bg-amber-500', slate: 'bg-slate-400' }[tone];
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <h2 className="text-sm font-bold font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      <span className="text-xs font-mono text-slate-400 dark:text-slate-600">{count}</span>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Failing jobs ──────────────────────────────────────────────────────────────

function FailingJobsSection({ jobs }: { jobs: FailingJob[] }) {
  if (jobs.length === 0) {
    return (
      <section>
        <SectionHeader title="Failing cron jobs" count={0} tone="slate" />
        <p className="text-sm text-slate-400 dark:text-slate-600 italic">All jobs' most recent run succeeded. Nothing to do here.</p>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader title="Failing cron jobs" count={jobs.length} tone="red" />
      <div className="space-y-2">
        {jobs.map(job => (
          <div key={job.job_id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{job.job_id}</span>
              <span className="text-[10px] font-mono text-slate-400">last failed {fmtDate(job.last_failed_at)}</span>
            </div>
            {job.error && <p className="text-xs font-mono text-red-500 break-words">{job.error}</p>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-2">
        Resolves itself once the job's next run succeeds — see <a href="/admin/cron" className="underline hover:text-slate-600 dark:hover:text-slate-400">Cron</a> for history and manual re-runs.
      </p>
    </section>
  );
}

// ── Open PRs ──────────────────────────────────────────────────────────────────

function OpenPRsSection({ prs }: { prs: FlaggedPullRequest[] | null }) {
  if (prs === null) {
    return (
      <section>
        <SectionHeader title="Open pull requests" count={0} tone="slate" />
        <p className="text-sm text-slate-400 dark:text-slate-600 italic">Couldn't reach GitHub — check back shortly.</p>
      </section>
    );
  }
  if (prs.length === 0) {
    return (
      <section>
        <SectionHeader title="Open pull requests" count={0} tone="slate" />
        <p className="text-sm text-slate-400 dark:text-slate-600 italic">Nothing open on GitHub right now.</p>
      </section>
    );
  }
  const stale = prs.filter(pr => pr.stale).length;
  return (
    <section>
      <SectionHeader title="Open pull requests" count={prs.length} tone={stale > 0 ? 'amber' : 'slate'} />
      <div className="space-y-2">
        {prs.map(pr => (
          <a
            key={pr.number}
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between gap-3 rounded-xl border p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors ${
              pr.stale ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs text-slate-400">#{pr.number}</span>
                {pr.draft && <Badge label="Draft" className="bg-slate-500/10 text-slate-500 border-slate-500/20" />}
                {pr.stale && <Badge label={`${pr.age_days}d old`} className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" />}
              </div>
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{pr.title}</p>
            </div>
            <span className="text-slate-300 dark:text-slate-700 shrink-0">→</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ── Manually tracked items ────────────────────────────────────────────────────

function ActionItemRow({ item }: { item: ActionItem }) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const done = item.status === 'done';

  return (
    <div className={`rounded-xl border p-4 transition-opacity ${done ? 'border-slate-200 dark:border-slate-800 opacity-50' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => toggleActionItem(item.id, !done))}
          aria-label={done ? 'Mark as open' : 'Mark as done'}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
            done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500'
          }`}
        >
          {done && <span className="text-white text-xs leading-none">✓</span>}
        </button>
        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${done ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
              {item.title}
            </span>
            <Badge label={CATEGORY_LABEL[item.category] ?? item.category} className={CATEGORY_COLOR[item.category] ?? CATEGORY_COLOR.general} />
          </div>
          {expanded && item.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{item.description}</p>
          )}
          {done && item.resolved_at && (
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-600 mt-1">
              done {fmtDate(item.resolved_at)}{item.resolved_by ? ` · ${item.resolved_by}` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteActionItem(item.id))}
          aria-label="Delete"
          className="text-slate-300 dark:text-slate-700 hover:text-red-500 text-xs shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function AddItemForm() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
      >
        + Track a new item
      </button>
    );
  }

  return (
    <form
      action={(fd) => startTransition(async () => { await createActionItem(fd); setOpen(false); })}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
    >
      <input
        name="title" required placeholder="What needs doing?" autoFocus
        className="w-full text-sm bg-transparent border-b border-slate-200 dark:border-slate-800 pb-2 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400"
      />
      <textarea
        name="description" placeholder="Details (optional)" rows={2}
        className="w-full text-sm bg-transparent border-b border-slate-200 dark:border-slate-800 pb-2 focus:outline-none focus:border-emerald-500 text-slate-900 dark:text-white placeholder:text-slate-400 resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <select name="category" defaultValue="general" className="text-xs font-mono bg-transparent border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-400">
          <option value="general">General</option>
          <option value="integration">Integration</option>
          <option value="security">Security</option>
          <option value="billing">Billing</option>
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-mono text-slate-400 hover:text-slate-600">Cancel</button>
          <button type="submit" disabled={pending} className="text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50">
            {pending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  );
}

function TrackedItemsSection({ items }: { items: ActionItem[] }) {
  const open = items.filter(i => i.status === 'open');
  const done = items.filter(i => i.status === 'done');
  return (
    <section>
      <SectionHeader title="Tracked items" count={open.length} tone={open.length > 0 ? 'amber' : 'slate'} />
      <div className="space-y-2">
        {open.map(item => <ActionItemRow key={item.id} item={item} />)}
        {open.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-600 italic">Nothing tracked.</p>}
      </div>
      <div className="mt-3">
        <AddItemForm />
      </div>
      {done.length > 0 && (
        <details className="mt-6">
          <summary className="text-xs font-mono text-slate-400 dark:text-slate-600 cursor-pointer hover:text-slate-600 dark:hover:text-slate-400">
            {done.length} done
          </summary>
          <div className="space-y-2 mt-3">
            {done.map(item => <ActionItemRow key={item.id} item={item} />)}
          </div>
        </details>
      )}
    </section>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function TodoClient({
  failingJobs, flaggedPRs, initialItems,
}: {
  failingJobs:  FailingJob[];
  flaggedPRs:   FlaggedPullRequest[] | null;
  initialItems: ActionItem[];
}) {
  const totalOpen = failingJobs.length + (flaggedPRs?.length ?? 0) + initialItems.filter(i => i.status === 'open').length;

  return (
    <div className="space-y-8">
      {totalOpen === 0 ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Nothing outstanding</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">All cron jobs healthy, no open PRs, no tracked items.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`rounded-2xl border p-6 ${failingJobs.length > 0 ? 'border-red-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Failing Jobs</p>
            <p className={`text-4xl font-black ${failingJobs.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{failingJobs.length}</p>
          </div>
          <div className={`rounded-2xl border p-6 ${flaggedPRs?.some(p => p.stale) ? 'border-amber-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Open PRs</p>
            <p className="text-4xl font-black text-slate-900 dark:text-white">{flaggedPRs?.length ?? '—'}</p>
          </div>
          <div className={`rounded-2xl border p-6 ${initialItems.some(i => i.status === 'open') ? 'border-amber-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Tracked Items</p>
            <p className="text-4xl font-black text-slate-900 dark:text-white">{initialItems.filter(i => i.status === 'open').length}</p>
          </div>
        </div>
      )}

      <FailingJobsSection jobs={failingJobs} />
      <OpenPRsSection prs={flaggedPRs} />
      <TrackedItemsSection items={initialItems} />
    </div>
  );
}
