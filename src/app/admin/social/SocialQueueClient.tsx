'use client';

import React, { useMemo, useState, useTransition } from 'react';
import type { SocialQueueRow } from './page';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function patchQueue(id: string, action: 'mark_manual_done' | 'retry'): Promise<void> {
  const res = await fetch('/api/admin/social', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Request failed');
  }
}

const PLATFORM_LABEL: Record<SocialQueueRow['platform'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

const PLATFORM_DOT: Record<SocialQueueRow['platform'], string> = {
  instagram: 'bg-fuchsia-500',
  facebook: 'bg-blue-500',
  linkedin: 'bg-sky-600',
};

function statusBadge(status: SocialQueueRow['status']): { text: string; cls: string } {
  switch (status) {
    case 'published':
    case 'manual_done':
      return { text: status === 'published' ? 'Published' : 'Posted', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'failed':
      return { text: 'Failed', cls: 'bg-red-500/10 text-red-400 border-red-500/30' };
    case 'manual_pending':
      return { text: 'Needs manual post', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'skipped':
      return { text: 'Skipped', cls: 'bg-slate-700/50 text-slate-400 border-slate-300 dark:border-slate-700' };
    default:
      return { text: 'Scheduled', cls: 'bg-slate-700/50 text-slate-400 border-slate-300 dark:border-slate-700' };
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── Row ───────────────────────────────────────────────────────────────────────

function QueueRow({ row, onUpdated }: { row: SocialQueueRow; onUpdated: (r: SocialQueueRow) => void }) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const badge = statusBadge(row.status);
  const fullText = row.hashtags ? `${row.caption}\n\n${row.hashtags}` : row.caption;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — silent */ }
  };

  const markDone = () => {
    setError('');
    startTransition(async () => {
      try {
        await patchQueue(row.id, 'mark_manual_done');
        onUpdated({ ...row, status: 'manual_done', published_at: new Date().toISOString() });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    });
  };

  const retry = () => {
    setError('');
    startTransition(async () => {
      try {
        await patchQueue(row.id, 'retry');
        onUpdated({ ...row, status: 'pending', attempt_count: 0, error_message: null });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 border-b border-slate-200 dark:border-slate-800 last:border-b-0">
      <div className="sm:w-40 shrink-0 flex sm:flex-col gap-2 sm:gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${PLATFORM_DOT[row.platform]}`} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{PLATFORM_LABEL[row.platform]}</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">{formatWhen(row.scheduled_at)}</span>
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">{row.series}</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{row.caption}</p>
        {row.hashtags && <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400 mt-1">{row.hashtags}</p>}
        {row.error_message && (
          <p className="text-xs text-red-500 mt-1">Error: {row.error_message} (attempt {row.attempt_count})</p>
        )}
        {row.external_post_id && (
          <p className="text-[11px] font-mono text-slate-500 mt-1">Post ID: {row.external_post_id}</p>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      <div className="sm:w-44 shrink-0 flex flex-col items-start sm:items-end gap-2">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${badge.cls}`}>{badge.text}</span>

        {row.platform === 'linkedin' && row.status === 'manual_pending' && (
          <div className="flex gap-2">
            <button
              onClick={copyText}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {copied ? 'Copied ✓' : 'Copy text'}
            </button>
            <button
              onClick={markDone}
              disabled={isPending}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-50"
            >
              Mark posted
            </button>
          </div>
        )}

        {row.status === 'failed' && (row.platform === 'instagram' || row.platform === 'facebook') && (
          <button
            onClick={retry}
            disabled={isPending}
            className="text-xs px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'due' | 'instagram' | 'facebook' | 'linkedin' | 'failed';

export function SocialQueueClient({ initialRows }: { initialRows: SocialQueueRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<Filter>('due');

  const updateRow = (updated: SocialQueueRow) => {
    setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)));
  };

  const counts = useMemo(() => ({
    total: rows.length,
    pendingMeta: rows.filter(r => r.status === 'pending' && r.platform !== 'linkedin').length,
    needsManual: rows.filter(r => r.status === 'manual_pending').length,
    published: rows.filter(r => r.status === 'published' || r.status === 'manual_done').length,
    failed: rows.filter(r => r.status === 'failed').length,
  }), [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    switch (filter) {
      case 'due':
        return rows.filter(r =>
          (r.status === 'pending' || r.status === 'manual_pending') &&
          new Date(r.scheduled_at).getTime() <= now + 24 * 60 * 60 * 1000,
        );
      case 'instagram': return rows.filter(r => r.platform === 'instagram');
      case 'facebook': return rows.filter(r => r.platform === 'facebook');
      case 'linkedin': return rows.filter(r => r.platform === 'linkedin');
      case 'failed': return rows.filter(r => r.status === 'failed');
      default: return rows;
    }
  }, [rows, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Social Publishing</h1>
          <p className="text-slate-400 text-sm mt-1">
            Instagram + Facebook auto-publish hourly via the Meta Graph API. LinkedIn is manual —
            copy the text below and post it yourself, then mark it done.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Auto-publish queued</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{counts.pendingMeta}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">Instagram + Facebook</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Needs manual post</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{counts.needsManual}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">LinkedIn</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Published</p>
          <p className="text-3xl font-black text-emerald-500">{counts.published}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">of {counts.total} total</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Failed</p>
          <p className="text-3xl font-black text-red-500">{counts.failed}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">retry below</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['due', 'all', 'instagram', 'facebook', 'linkedin', 'failed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors ${
              filter === f
                ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {f === 'due' ? 'Due next 24h' : f}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nothing here.</p>
        ) : (
          filtered.map(row => <QueueRow key={row.id} row={row} onUpdated={updateRow} />)
        )}
      </div>
    </div>
  );
}
