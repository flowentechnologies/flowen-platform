'use client';

import { useState, useTransition } from 'react';
import type { InsurancePolicyRow } from './page';

function fmtMoney(pence: number | null): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/insurance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ item?: InsurancePolicyRow; error?: string }>;
}

function AddForm({ onAdded }: { onAdded: (row: InsurancePolicyRow) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    policy_type: '', provider: '', policy_number: '', entity: '',
    coverage_amount: '', start_date: '', end_date: '', notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function submit() {
    if (!form.policy_type.trim()) { setError('Policy type is required'); return; }
    setError(null);
    start(async () => {
      const res = await apiPost({
        policy_type: form.policy_type,
        provider: form.provider || undefined,
        policy_number: form.policy_number || undefined,
        entity: form.entity || undefined,
        coverage_amount_pence: form.coverage_amount ? Math.round(Number(form.coverage_amount) * 100) : undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        notes: form.notes || undefined,
      });
      if (res.error || !res.item) { setError(res.error ?? 'Failed to add'); return; }
      onAdded(res.item);
      setForm({ policy_type: '', provider: '', policy_number: '', entity: '', coverage_amount: '', start_date: '', end_date: '', notes: '' });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-sm font-mono font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        + Add policy
      </button>
    );
  }

  const inputCls = "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input placeholder="Policy type (e.g. Professional Indemnity)" value={form.policy_type} onChange={e => set('policy_type', e.target.value)} className={inputCls} />
        <input placeholder="Provider (e.g. Hiscox)" value={form.provider} onChange={e => set('provider', e.target.value)} className={inputCls} />
        <input placeholder="Policy number" value={form.policy_number} onChange={e => set('policy_number', e.target.value)} className={inputCls} />
        <input placeholder="Entity covered (e.g. Flowen Speech Technologies Ltd)" value={form.entity} onChange={e => set('entity', e.target.value)} className={inputCls} />
        <input placeholder="Coverage amount (£)" type="number" value={form.coverage_amount} onChange={e => set('coverage_amount', e.target.value)} className={inputCls} />
        <div className="flex gap-2">
          <input placeholder="Start date" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={`flex-1 ${inputCls}`} />
          <input placeholder="End date" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={`flex-1 ${inputCls}`} />
        </div>
        <textarea placeholder="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={`sm:col-span-2 ${inputCls}`} />
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

export function InsuranceClient({ initialItems }: { initialItems: InsurancePolicyRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);

  function remove(id: string) {
    if (!confirm('Remove this policy from the register? This cannot be undone.')) return;
    setBusyId(id);
    void fetch('/api/admin/insurance', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then(async res => {
      if (res.ok) setItems(prev => prev.filter(i => i.id !== id));
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-4">
      <AddForm onAdded={row => setItems(prev => [row, ...prev])} />

      {items.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Provider</th>
                  <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden md:table-cell">Entity</th>
                  <th className="text-right px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Coverage</th>
                  <th className="text-right px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Expires</th>
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map(row => (
                  <tr key={row.id} className="border-b border-slate-200 dark:border-slate-800/60 last:border-0">
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold">{row.policy_type}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.provider ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">{row.entity ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">{fmtMoney(row.coverage_amount_pence)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400">{fmtDate(row.end_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" disabled={busyId === row.id} onClick={() => remove(row.id)}
                        className="text-[10px] font-mono text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
