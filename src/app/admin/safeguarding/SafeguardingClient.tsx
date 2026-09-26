'use client';

import { useState, useTransition } from 'react';
import type { SafeguardingConcernRow } from './page';

const CATEGORY_LABEL: Record<string, string> = {
  disclosure: 'Disclosure',
  self_harm_risk: 'Self-harm risk',
  referral_needed: 'Referral needed',
  other: 'Other',
};

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-red-500/10 text-red-400 border-red-500/30',
  escalated: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  referred_external: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function apiCall(method: 'POST' | 'PATCH', payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/safeguarding', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ item?: SafeguardingConcernRow; error?: string }>;
}

function LogConcernForm({ onAdded }: { onAdded: (row: SafeguardingConcernRow) => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function submit() {
    if (!description.trim()) { setError('Description is required'); return; }
    setError(null);
    start(async () => {
      const res = await apiCall('POST', { category, description });
      if (res.error || !res.item) { setError(res.error ?? 'Failed to log'); return; }
      onAdded(res.item);
      setDescription('');
      setCategory('other');
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-sm font-mono font-bold px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors">
        + Log a concern
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-red-500/30 rounded-2xl p-5 space-y-3">
      <select value={category} onChange={e => setCategory(e.target.value)}
        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
        {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <textarea
        placeholder="What happened, when, and who's involved — factual, not speculative"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={4}
        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
      />
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={isPending}
          className="text-sm font-mono font-bold px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50">
          {isPending ? 'Logging…' : 'Log concern'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-sm font-mono px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function ConcernCard({ row, onUpdated }: { row: SafeguardingConcernRow; onUpdated: (row: SafeguardingConcernRow) => void }) {
  const [escalatedTo, setEscalatedTo] = useState(row.escalated_to ?? '');
  const [notes, setNotes] = useState(row.resolution_notes ?? '');
  const [isPending, start] = useTransition();

  function setStatus(status: string) {
    start(async () => {
      const res = await apiCall('PATCH', { id: row.id, status, escalated_to: escalatedTo || undefined, resolution_notes: notes || undefined });
      if (res.item) onUpdated(res.item);
    });
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-slate-400">{CATEGORY_LABEL[row.category] ?? row.category}</span>
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">{fmtDate(row.created_at)} · {row.raised_by ?? 'unknown'}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${STATUS_STYLE[row.status] ?? ''}`}>
          {row.status.replace('_', ' ')}
        </span>
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{row.description}</p>

      {row.status !== 'resolved' && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <input
            placeholder="Escalated to (name/org, if applicable)"
            value={escalatedTo}
            onChange={e => setEscalatedTo(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
          <textarea
            placeholder="Resolution notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
          />
          <div className="flex gap-2 flex-wrap">
            {row.status === 'open' && (
              <button type="button" disabled={isPending} onClick={() => setStatus('escalated')}
                className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50">
                Mark escalated
              </button>
            )}
            <button type="button" disabled={isPending} onClick={() => setStatus('referred_external')}
              className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
              Referred externally
            </button>
            <button type="button" disabled={isPending} onClick={() => setStatus('resolved')}
              className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50">
              Mark resolved
            </button>
          </div>
        </div>
      )}
      {row.status === 'resolved' && row.resolution_notes && (
        <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
          Resolved {row.resolved_at ? fmtDate(row.resolved_at) : ''}: {row.resolution_notes}
        </p>
      )}
    </div>
  );
}

export function SafeguardingClient({ initialItems }: { initialItems: SafeguardingConcernRow[] }) {
  const [items, setItems] = useState(initialItems);

  return (
    <div className="space-y-4">
      <LogConcernForm onAdded={row => setItems(prev => [row, ...prev])} />

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No concerns logged.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(row => (
            <ConcernCard key={row.id} row={row} onUpdated={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))} />
          ))}
        </div>
      )}
    </div>
  );
}
