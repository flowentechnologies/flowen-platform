'use client';

import { useState, useTransition } from 'react';
import type { CompanyRecordRow } from './page';

const ENTITY_LABEL: Record<string, string> = {
  group: 'Flowen Group Ltd',
  ip: 'Flowen IP Ltd',
  labs: 'Flowen Labs Ltd',
  'speech-technologies': 'Flowen Speech Technologies Ltd',
};

const RECORD_TYPE_LABEL: Record<string, string> = {
  corporation_tax_utr: 'Corporation Tax UTR',
  vat_number: 'VAT Number',
  paye_reference: 'PAYE Reference',
  companies_house_auth_code: 'Companies House Auth Code',
  other: 'Other',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function AddForm({ onAdded }: { onAdded: (row: CompanyRecordRow) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ entity: 'group', record_type: 'corporation_tax_utr', value: '', issued_by: '', issued_date: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function submit() {
    if (!form.value.trim()) { setError('Value is required'); return; }
    setError(null);
    start(async () => {
      const res = await fetch('/api/admin/company-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, issued_by: form.issued_by || undefined, issued_date: form.issued_date || undefined, notes: form.notes || undefined }),
      });
      const data = await res.json();
      if (data.error || !data.item) { setError(data.error ?? 'Failed to add'); return; }
      onAdded(data.item);
      setForm({ entity: 'group', record_type: 'corporation_tax_utr', value: '', issued_by: '', issued_date: '', notes: '' });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-sm font-mono font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        + Add record
      </button>
    );
  }

  const inputCls = "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select value={form.entity} onChange={e => set('entity', e.target.value)} className={inputCls}>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={form.record_type} onChange={e => set('record_type', e.target.value)} className={inputCls}>
          {Object.entries(RECORD_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input placeholder="Value (e.g. the UTR/VAT number itself)" value={form.value} onChange={e => set('value', e.target.value)} className={inputCls} />
        <input placeholder="Issued by (e.g. HMRC)" value={form.issued_by} onChange={e => set('issued_by', e.target.value)} className={inputCls} />
        <input placeholder="Issued date" type="date" value={form.issued_date} onChange={e => set('issued_date', e.target.value)} className={inputCls} />
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

export function CompanyRecordsClient({ initialItems }: { initialItems: CompanyRecordRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);

  function remove(id: string) {
    if (!confirm('Remove this record? This cannot be undone.')) return;
    setBusyId(id);
    void fetch('/api/admin/company-records', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then(res => {
      if (res.ok) setItems(prev => prev.filter(i => i.id !== id));
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-4">
      <AddForm onAdded={row => setItems(prev => [row, ...prev])} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(row => (
          <div key={row.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-slate-400">{ENTITY_LABEL[row.entity] ?? row.entity}</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{RECORD_TYPE_LABEL[row.record_type] ?? row.record_type}</p>
              </div>
              <button type="button" disabled={busyId === row.id} onClick={() => remove(row.id)}
                className="text-[10px] font-mono text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40">
                Remove
              </button>
            </div>
            <p className="text-lg font-mono text-slate-700 dark:text-slate-300">{row.value}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {row.issued_by ?? '—'} · {fmtDate(row.issued_date)}
            </p>
            {row.notes && <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 leading-relaxed">{row.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
