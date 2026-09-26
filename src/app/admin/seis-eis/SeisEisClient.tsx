'use client';

import { useState, useTransition } from 'react';
import type { SeisEisStatusRow } from './page';

const STATUS_LABEL: Record<string, string> = {
  drafted: 'Application drafted',
  submitted: 'Submitted to HMRC',
  granted: 'Advance Assurance granted',
  declined: 'Declined',
};
const STATUS_STYLE: Record<string, string> = {
  drafted: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
  submitted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  granted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  declined: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function fmtMoney(pence: number | null): string {
  if (pence == null) return '—';
  return `£${(pence / 100).toLocaleString('en-GB')}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Required fields for the application to actually be submittable — mirrors
// the [FILL IN] placeholders in the real letter, so "what's still missing"
// is answered by this list rather than by re-reading the document.
function outstandingFields(item: SeisEisStatusRow): string[] {
  const missing: string[] = [];
  if (item.consolidated_gross_assets_pence == null) missing.push('Consolidated group gross assets');
  if (item.total_fte == null) missing.push('Total FTE headcount');
  if (!item.first_trading_date) missing.push('First commercial sale / trading date');
  if (item.prior_eis_vct_investment == null) missing.push('Prior EIS/VCT investment history (yes/no)');
  return missing;
}

interface Field {
  key: keyof SeisEisStatusRow;
  label: string;
  type: 'text' | 'number' | 'money' | 'date' | 'boolean' | 'textarea';
}

const FIELDS: Field[] = [
  { key: 'consolidated_gross_assets_pence', label: 'Consolidated group gross assets', type: 'money' },
  { key: 'total_fte', label: 'Total FTE headcount', type: 'number' },
  { key: 'first_trading_date', label: 'First commercial sale / trading date', type: 'date' },
  { key: 'prior_eis_vct_investment', label: 'Any prior EIS/VCT investment?', type: 'boolean' },
  { key: 'prior_eis_vct_notes', label: 'Prior EIS/VCT notes', type: 'textarea' },
];

export function SeisEisClient({ item: initialItem }: { item: SeisEisStatusRow | null }) {
  const [item, setItem] = useState(initialItem);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [isPending, start] = useTransition();
  const [savedMsg, setSavedMsg] = useState(false);

  if (!item) {
    return <p className="text-sm text-slate-400">No SEIS/EIS record found — the migration seeding this should have created one. Contact support.</p>;
  }

  const missing = outstandingFields(item);

  function setEdit(key: string, value: string) {
    setEdits(prev => ({ ...prev, [key]: value }));
  }

  function saveField(field: Field) {
    const raw = edits[field.key];
    if (raw === undefined) return;
    let value: unknown = raw;
    if (field.type === 'money') value = raw === '' ? null : Math.round(Number(raw) * 100);
    if (field.type === 'number') value = raw === '' ? null : Number(raw);
    if (field.type === 'boolean') value = raw === '' ? null : raw === 'true';
    if (field.type === 'date') value = raw === '' ? null : raw;

    start(async () => {
      const res = await fetch('/api/admin/seis-eis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item!.id, [field.key]: value }),
      });
      const data = await res.json();
      if (data.item) {
        setItem(data.item);
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 2000);
      }
    });
  }

  function setStatus(status: string) {
    start(async () => {
      const res = await fetch('/api/admin/seis-eis', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item!.id, advance_assurance_status: status }),
      });
      const data = await res.json();
      if (data.item) setItem(data.item);
    });
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wide text-slate-400 mb-2">Advance Assurance Status</p>
            <span className={`px-3 py-1 rounded-full text-sm font-mono font-bold border ${STATUS_STYLE[item.advance_assurance_status]}`}>
              {STATUS_LABEL[item.advance_assurance_status]}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.keys(STATUS_LABEL).map(s => (
              <button key={s} type="button" disabled={isPending || s === item.advance_assurance_status} onClick={() => setStatus(s)}
                className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 transition-colors">
                Mark {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        {item.advance_assurance_reference && (
          <p className="text-xs text-slate-500 mt-3 font-mono">HMRC reference: {item.advance_assurance_reference}</p>
        )}
      </div>

      {/* Outstanding fields banner */}
      {missing.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-500 mb-1">Not yet submittable — {missing.length} field{missing.length === 1 ? '' : 's'} still needed</p>
          <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc list-inside space-y-0.5">
            {missing.map(m => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

      {savedMsg && <p className="text-xs text-emerald-400 font-mono">Saved</p>}

      {/* Editable fields */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-200 dark:divide-slate-800">
        {FIELDS.map(field => {
          const currentValue = item[field.key];
          let displayValue: string;
          if (field.type === 'money') displayValue = fmtMoney(currentValue as number | null);
          else if (field.type === 'date') displayValue = fmtDate(currentValue as string | null);
          else if (field.type === 'boolean') displayValue = currentValue == null ? '—' : (currentValue ? 'Yes' : 'No');
          else displayValue = (currentValue as string | null) ?? '—';

          return (
            <div key={field.key} className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="sm:w-64 shrink-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{field.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{currentValue == null || currentValue === '' ? 'Not set' : displayValue}</p>
              </div>
              <div className="flex-1 flex gap-2">
                {field.type === 'boolean' ? (
                  <select
                    defaultValue={currentValue == null ? '' : String(currentValue)}
                    onChange={e => setEdit(field.key, e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="">Unknown</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    defaultValue={(currentValue as string | null) ?? ''}
                    onChange={e => setEdit(field.key, e.target.value)}
                    rows={2}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white"
                  />
                ) : (
                  <input
                    type={field.type === 'money' ? 'number' : field.type === 'date' ? 'date' : field.type}
                    defaultValue={field.type === 'money' && currentValue != null ? String((currentValue as number) / 100) : (currentValue as string | number | null) ?? ''}
                    onChange={e => setEdit(field.key, e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white"
                  />
                )}
                <button type="button" disabled={isPending} onClick={() => saveField(field)}
                  className="text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* SEIS1 filing */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">SEIS1 compliance statement</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Filed with HMRC after shares are actually issued to an investor, once the qualifying trading period has elapsed — this is what triggers the SEIS3 certificates investors need to claim relief.
        </p>
        <span className={`px-3 py-1 rounded-full text-sm font-mono font-bold border ${item.seis1_filed ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600/30'}`}>
          {item.seis1_filed ? `Filed ${fmtDate(item.seis1_filed_at)}` : 'Not yet filed'}
        </span>
      </div>
    </div>
  );
}
