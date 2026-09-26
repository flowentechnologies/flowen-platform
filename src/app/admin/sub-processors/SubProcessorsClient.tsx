'use client';

import { useState, useTransition } from 'react';
import type { SubProcessorRow } from './page';

async function apiCall(method: 'POST' | 'PATCH', payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/sub-processors', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ item?: SubProcessorRow; error?: string }>;
}

function AddForm({ onAdded }: { onAdded: (row: SubProcessorRow) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', purpose: '', data_categories: '', location: '', safeguard: '' });
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function submit() {
    if (Object.values(form).some(v => !v.trim())) { setError('All fields are required'); return; }
    setError(null);
    start(async () => {
      const res = await apiCall('POST', form);
      if (res.error || !res.item) { setError(res.error ?? 'Failed to add'); return; }
      onAdded(res.item);
      setForm({ name: '', purpose: '', data_categories: '', location: '', safeguard: '' });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-mono font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        + Add sub-processor
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input placeholder="Vendor legal name (e.g. Acme Inc.)" value={form.name} onChange={e => set('name', e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
        <input placeholder="Purpose (what they do for us)" value={form.purpose} onChange={e => set('purpose', e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
        <input placeholder="Data categories they can see" value={form.data_categories} onChange={e => set('data_categories', e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
        <input placeholder="Location (e.g. US/EU)" value={form.location} onChange={e => set('location', e.target.value)}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
        <input placeholder="Safeguard (e.g. SCCs + UK Addendum)" value={form.safeguard} onChange={e => set('safeguard', e.target.value)}
          className="sm:col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" />
      </div>
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={isPending}
          className="text-sm font-mono font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
          {isPending ? 'Adding…' : 'Add'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-sm font-mono px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SubProcessorsClient({ initialItems }: { initialItems: SubProcessorRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);

  function toggleActive(row: SubProcessorRow) {
    setBusyId(row.id);
    void apiCall('PATCH', { id: row.id, active: !row.active }).then(res => {
      if (res.item) setItems(prev => prev.map(i => i.id === row.id ? res.item! : i));
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-4">
      <AddForm onAdded={row => setItems(prev => [row, ...prev])} />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Vendor</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Purpose</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden md:table-cell">Data</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden lg:table-cell">Location</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden lg:table-cell">Safeguard</th>
                <th className="text-right px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Status</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map(row => (
                <tr key={row.id} className={`border-b border-slate-200 dark:border-slate-800/60 last:border-0 ${!row.active ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.purpose}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">{row.data_categories}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono hidden lg:table-cell">{row.location}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell">{row.safeguard}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                      row.active
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-700/50 text-slate-500 border-slate-600/30'
                    }`}>
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => toggleActive(row)}
                      className="text-[10px] font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40"
                    >
                      {row.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-500 font-mono">
        Deactivating doesn&rsquo;t delete the row — it stops it appearing on /dpa while keeping the record for audit history.
      </p>
    </div>
  );
}
