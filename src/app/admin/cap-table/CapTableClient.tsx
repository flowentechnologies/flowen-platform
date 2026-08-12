'use client';

import React, { useState, useTransition, useMemo } from 'react';
import type { CapTableEntry, HolderType, Instrument } from '@/app/api/admin/cap-table/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(pence: number | null | undefined): string {
  if (pence == null) return '—';
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(2)}m`;
  if (pounds >= 1_000) return `£${(pounds / 1_000).toFixed(0)}k`;
  return `£${pounds.toLocaleString('en-GB')}`;
}

function fmtPence(pence: number | null | undefined): string {
  if (pence == null) return '—';
  if (pence < 100) return `${pence}p`;
  return `£${(pence / 100).toFixed(2)}`;
}

function fmtShares(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-GB');
}

function fmtPct(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}%`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function apiCall(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/cap-table', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HOLDER_TYPES: { id: HolderType; label: string }[] = [
  { id: 'founder',  label: 'Founder' },
  { id: 'investor', label: 'Investor' },
  { id: 'employee', label: 'Employee' },
  { id: 'advisor',  label: 'Advisor' },
  { id: 'pool',     label: 'Option Pool' },
];

const INSTRUMENTS: { id: Instrument; label: string }[] = [
  { id: 'ordinary_shares',   label: 'Ordinary Shares' },
  { id: 'preference_shares', label: 'Preference Shares' },
  { id: 'safe_note',         label: 'SAFE Note' },
  { id: 'convertible_loan',  label: 'Convertible Loan' },
  { id: 'emi_option',        label: 'EMI Option' },
  { id: 'unapproved_option', label: 'Unapproved Option' },
  { id: 'warrant',           label: 'Warrant' },
];

const HOLDER_COLORS: Record<HolderType, string> = {
  founder:  'bg-emerald-500',
  investor: 'bg-amber-500',
  pool:     'bg-purple-500',
  employee: 'bg-sky-500',
  advisor:  'bg-slate-500',
};

const HOLDER_TEXT: Record<HolderType, string> = {
  founder:  'text-emerald-400',
  investor: 'text-amber-400',
  pool:     'text-purple-400',
  employee: 'text-sky-400',
  advisor:  'text-slate-400',
};

const HOLDER_BADGE: Record<HolderType, string> = {
  founder:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  investor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  pool:     'bg-purple-500/10 text-purple-400 border-purple-500/30',
  employee: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  advisor:  'bg-slate-600/20 text-slate-400 border-slate-600/40',
};

const INSTRUMENT_LABEL: Record<Instrument, string> = {
  ordinary_shares:   'Ordinary Shares',
  preference_shares: 'Preference Shares',
  safe_note:         'SAFE Note',
  convertible_loan:  'Convertible Loan',
  emi_option:        'EMI Option',
  unapproved_option: 'Unapproved Option',
  warrant:           'Warrant',
};

const EQUITY_INSTRUMENTS: Instrument[] = ['ordinary_shares', 'preference_shares'];
const CONVERTIBLE_INSTRUMENTS: Instrument[] = ['safe_note', 'convertible_loan'];
const OPTION_INSTRUMENTS: Instrument[] = ['emi_option', 'unapproved_option', 'warrant'];

function isEquity(i: Instrument) { return EQUITY_INSTRUMENTS.includes(i); }
function isConvertible(i: Instrument) { return CONVERTIBLE_INSTRUMENTS.includes(i); }
function isOption(i: Instrument) { return OPTION_INSTRUMENTS.includes(i); }

// ── Blank form ────────────────────────────────────────────────────────────────

interface FormValues {
  holder_name: string;
  holder_type: HolderType;
  instrument: Instrument;
  shares: string;
  share_class: string;
  price_per_share_pence: string;
  amount_pence: string;
  valuation_cap_pence: string;
  discount_pct: string;
  interest_rate_pct: string;
  vesting_start: string;
  vesting_months: string;
  cliff_months: string;
  seis_eligible: boolean;
  eis_eligible: boolean;
  certificate_ref: string;
  issued_at: string;
  notes: string;
}

const BLANK_FORM: FormValues = {
  holder_name: '',
  holder_type: 'founder',
  instrument: 'ordinary_shares',
  shares: '',
  share_class: '',
  price_per_share_pence: '',
  amount_pence: '',
  valuation_cap_pence: '',
  discount_pct: '',
  interest_rate_pct: '',
  vesting_start: '',
  vesting_months: '',
  cliff_months: '',
  seis_eligible: false,
  eis_eligible: false,
  certificate_ref: '',
  issued_at: '',
  notes: '',
};

function entryToForm(e: CapTableEntry): FormValues {
  return {
    holder_name: e.holder_name,
    holder_type: e.holder_type,
    instrument: e.instrument,
    shares: e.shares?.toString() ?? '',
    share_class: e.share_class ?? '',
    price_per_share_pence: e.price_per_share_pence?.toString() ?? '',
    amount_pence: e.amount_pence?.toString() ?? '',
    valuation_cap_pence: e.valuation_cap_pence?.toString() ?? '',
    discount_pct: e.discount_pct?.toString() ?? '',
    interest_rate_pct: e.interest_rate_pct?.toString() ?? '',
    vesting_start: e.vesting_start ?? '',
    vesting_months: e.vesting_months?.toString() ?? '',
    cliff_months: e.cliff_months?.toString() ?? '',
    seis_eligible: e.seis_eligible,
    eis_eligible: e.eis_eligible,
    certificate_ref: e.certificate_ref ?? '',
    issued_at: e.issued_at ?? '',
    notes: e.notes ?? '',
  };
}

function formToPayload(f: FormValues): Record<string, unknown> {
  return {
    holder_name: f.holder_name.trim(),
    holder_type: f.holder_type,
    instrument: f.instrument,
    shares: f.shares ? parseInt(f.shares, 10) : null,
    share_class: f.share_class.trim() || null,
    price_per_share_pence: f.price_per_share_pence ? parseInt(f.price_per_share_pence, 10) : null,
    amount_pence: f.amount_pence ? parseInt(f.amount_pence, 10) : null,
    valuation_cap_pence: f.valuation_cap_pence ? parseInt(f.valuation_cap_pence, 10) : null,
    discount_pct: f.discount_pct ? parseFloat(f.discount_pct) : null,
    interest_rate_pct: f.interest_rate_pct ? parseFloat(f.interest_rate_pct) : null,
    vesting_start: f.vesting_start || null,
    vesting_months: f.vesting_months ? parseInt(f.vesting_months, 10) : null,
    cliff_months: f.cliff_months ? parseInt(f.cliff_months, 10) : null,
    seis_eligible: f.seis_eligible,
    eis_eligible: f.eis_eligible,
    certificate_ref: f.certificate_ref.trim() || null,
    issued_at: f.issued_at || null,
    notes: f.notes.trim() || null,
  };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Ownership strip ───────────────────────────────────────────────────────────

interface OwnerSegment {
  label: string;
  pct: number;
  color: string;
  textColor: string;
}

function OwnershipStrip({ segments }: { segments: OwnerSegment[] }) {
  return (
    <div className="space-y-3">
      <div className="flex h-8 rounded-lg overflow-hidden w-full">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`${seg.color} flex items-center justify-center transition-all`}
            style={{ width: `${seg.pct}%`, minWidth: seg.pct > 3 ? undefined : '2px' }}
            title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${seg.color} shrink-0`} />
            <span className="text-xs text-slate-600 dark:text-slate-300">{seg.label}</span>
            <span className={`text-xs font-bold tabular-nums ${seg.textColor}`}>{seg.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Entry form ────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">{children}</label>;
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white dark:bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-white dark:bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
    >
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-emerald-500"
      />
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
    </label>
  );
}

interface EntryFormProps {
  initial?: CapTableEntry;
  onSave: (entry: CapTableEntry) => void;
  onCancel: () => void;
}

function EntryForm({ initial, onSave, onCancel }: EntryFormProps) {
  const [form, setForm] = useState<FormValues>(initial ? entryToForm(initial) : BLANK_FORM);
  const [saving, startSaving] = useTransition();
  const [err, setErr] = useState('');

  const set = (k: keyof FormValues) => (v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const instr = form.instrument;
  const showEquityFields = isEquity(instr);
  const showConvertibleFields = isConvertible(instr);
  const showOptionFields = isOption(instr) || form.holder_type === 'pool';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.holder_name.trim()) { setErr('Holder name is required'); return; }
    setErr('');
    startSaving(async () => {
      const payload = formToPayload(form);
      let res;
      if (initial) {
        res = await apiCall('update', { id: initial.id, ...payload });
      } else {
        res = await apiCall('add', payload);
      }
      if (res.error) { setErr(res.error); return; }
      onSave(res.entry);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{initial ? 'Edit Entry' : 'Add Entry'}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Holder Name</FieldLabel>
          <TextInput value={form.holder_name} onChange={set('holder_name')} placeholder="e.g. Howard (Founder)" />
        </div>
        <div>
          <FieldLabel>Holder Type</FieldLabel>
          <Select value={form.holder_type} onChange={v => set('holder_type')(v)} options={HOLDER_TYPES.map(h => ({ id: h.id, label: h.label }))} />
        </div>
        <div>
          <FieldLabel>Instrument</FieldLabel>
          <Select value={form.instrument} onChange={v => set('instrument')(v)} options={INSTRUMENTS.map(i => ({ id: i.id, label: i.label }))} />
        </div>
        {(showEquityFields || showOptionFields) && (
          <div>
            <FieldLabel>Shares / Options</FieldLabel>
            <TextInput value={form.shares} onChange={set('shares')} type="number" placeholder="e.g. 1000000" />
          </div>
        )}
        {showEquityFields && (
          <>
            <div>
              <FieldLabel>Share Class</FieldLabel>
              <TextInput value={form.share_class} onChange={set('share_class')} placeholder="e.g. A Ordinary" />
            </div>
            <div>
              <FieldLabel>Price per Share (pence)</FieldLabel>
              <TextInput value={form.price_per_share_pence} onChange={set('price_per_share_pence')} type="number" placeholder="e.g. 1" />
            </div>
            <div>
              <FieldLabel>Total Amount (pence)</FieldLabel>
              <TextInput value={form.amount_pence} onChange={set('amount_pence')} type="number" placeholder="e.g. 50000" />
            </div>
            <div>
              <FieldLabel>Certificate Ref</FieldLabel>
              <TextInput value={form.certificate_ref} onChange={set('certificate_ref')} placeholder="e.g. SC-001" />
            </div>
            <div>
              <FieldLabel>Issued Date</FieldLabel>
              <TextInput value={form.issued_at} onChange={set('issued_at')} type="date" />
            </div>
          </>
        )}
        {showConvertibleFields && (
          <>
            <div>
              <FieldLabel>Amount (pence)</FieldLabel>
              <TextInput value={form.amount_pence} onChange={set('amount_pence')} type="number" placeholder="e.g. 5000000" />
            </div>
            <div>
              <FieldLabel>Valuation Cap (pence)</FieldLabel>
              <TextInput value={form.valuation_cap_pence} onChange={set('valuation_cap_pence')} type="number" placeholder="e.g. 250000000" />
            </div>
            <div>
              <FieldLabel>Discount %</FieldLabel>
              <TextInput value={form.discount_pct} onChange={set('discount_pct')} type="number" placeholder="e.g. 20" />
            </div>
            {form.instrument === 'convertible_loan' && (
              <div>
                <FieldLabel>Interest Rate %</FieldLabel>
                <TextInput value={form.interest_rate_pct} onChange={set('interest_rate_pct')} type="number" placeholder="e.g. 8" />
              </div>
            )}
          </>
        )}
        {(showOptionFields || showConvertibleFields) && (
          <>
            <div>
              <FieldLabel>Vesting Start</FieldLabel>
              <TextInput value={form.vesting_start} onChange={set('vesting_start')} type="date" />
            </div>
            <div>
              <FieldLabel>Vesting Months (total)</FieldLabel>
              <TextInput value={form.vesting_months} onChange={set('vesting_months')} type="number" placeholder="e.g. 48" />
            </div>
            <div>
              <FieldLabel>Cliff Months</FieldLabel>
              <TextInput value={form.cliff_months} onChange={set('cliff_months')} type="number" placeholder="e.g. 12" />
            </div>
          </>
        )}
      </div>

      <div className="flex gap-6">
        <CheckboxField label="SEIS Eligible" checked={form.seis_eligible} onChange={set('seis_eligible')} />
        <CheckboxField label="EIS Eligible" checked={form.eis_eligible} onChange={set('eis_eligible')} />
      </div>

      <div>
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={form.notes}
          onChange={e => set('notes')(e.target.value)}
          rows={3}
          placeholder="Any relevant notes..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
        />
      </div>

      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Entry'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Holdings table ────────────────────────────────────────────────────────────

interface HoldingsTableProps {
  entries: CapTableEntry[];
  totalIssued: number;
  fullyDiluted: number;
  onEdit: (e: CapTableEntry) => void;
  onDelete: (id: string) => void;
}

function HoldingsTable({ entries, totalIssued, fullyDiluted, onEdit, onDelete }: HoldingsTableProps) {
  const groups: { label: string; type: HolderType }[] = [
    { label: 'Founders', type: 'founder' },
    { label: 'Investors', type: 'investor' },
    { label: 'Employee Pool', type: 'employee' },
    { label: 'Advisors', type: 'advisor' },
    { label: 'Option Pool', type: 'pool' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Holder</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Instrument</th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Shares</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Class</th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">% Issued</th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">% FD</th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Price/Share</th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Amount</th>
            <th className="text-center px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">SEIS/EIS</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Cert.</th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Issued</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {groups.map(({ label, type }) => {
            const rows = entries.filter(e => e.holder_type === type);
            if (rows.length === 0) return null;
            return (
              <React.Fragment key={type}>
                <tr className="bg-slate-50 dark:bg-slate-950">
                  <td colSpan={12} className={`px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-widest ${HOLDER_TEXT[type]}`}>
                    {label}
                  </td>
                </tr>
                {rows.map(entry => {
                  const isConv = isConvertible(entry.instrument);
                  const pctIssued = entry.shares && totalIssued > 0
                    ? ((entry.shares / totalIssued) * 100)
                    : null;
                  const pctFD = entry.shares && fullyDiluted > 0
                    ? ((entry.shares / fullyDiluted) * 100)
                    : null;

                  return (
                    <tr
                      key={entry.id}
                      className="border-t border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">{entry.holder_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-700">
                          {INSTRUMENT_LABEL[entry.instrument]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {isConv ? '—' : fmtShares(entry.shares)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{entry.share_class ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {isConv ? <span className="text-amber-400 text-[10px]">converts</span> : fmtPct(pctIssued)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {isConv ? '—' : fmtPct(pctFD)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {fmtPence(entry.price_per_share_pence)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {isConv
                          ? <span>{fmtGBP(entry.amount_pence)} <span className="text-slate-600">/</span> <span className="text-amber-400/80">{fmtGBP(entry.valuation_cap_pence)} cap</span></span>
                          : fmtGBP(entry.amount_pence)
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          {entry.seis_eligible && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">SEIS</span>
                          )}
                          {entry.eis_eligible && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">EIS</span>
                          )}
                          {!entry.seis_eligible && !entry.eis_eligible && (
                            <span className="text-slate-700">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">{entry.certificate_ref ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(entry.issued_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onEdit(entry)}
                            className="px-2 py-1 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDelete(entry.id)}
                            className="px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab 2: Instruments detail ─────────────────────────────────────────────────

function vestingDescription(e: CapTableEntry): string {
  if (!e.vesting_months) return 'No vesting schedule';
  const cliff = e.cliff_months ? `${e.cliff_months}m cliff, ` : '';
  return `${cliff}${e.vesting_months}m total`;
}

function vestedPct(e: CapTableEntry): number {
  if (!e.vesting_start || !e.vesting_months) return 0;
  const start = new Date(e.vesting_start).getTime();
  const now = Date.now();
  const elapsedMonths = Math.max(0, (now - start) / (1000 * 60 * 60 * 24 * 30.44));
  const cliff = e.cliff_months ?? 0;
  if (elapsedMonths < cliff) return 0;
  return Math.min(100, (elapsedMonths / e.vesting_months) * 100);
}

function ConvertibleCard({ entry }: { entry: CapTableEntry }) {
  const amount = entry.amount_pence ? entry.amount_pence / 100 : null;
  const cap = entry.valuation_cap_pence ? entry.valuation_cap_pence / 100 : null;
  const estimatedShares = amount && cap
    ? Math.round((amount / cap) * 7_000_000) // rough: shares at cap
    : null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.holder_name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {INSTRUMENT_LABEL[entry.instrument]}
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{fmtGBP(entry.amount_pence)}</p>
          <p className="text-[10px] text-slate-500">invested</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-0.5">Val. Cap</p>
          <p className="text-sm font-semibold text-amber-400">{fmtGBP(entry.valuation_cap_pence)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-0.5">Discount</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.discount_pct != null ? `${entry.discount_pct}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-0.5">Interest</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.interest_rate_pct != null ? `${entry.interest_rate_pct}%` : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-0.5">Est. shares at cap</p>
          <p className="text-sm font-semibold text-purple-400">{estimatedShares != null ? fmtShares(estimatedShares) : '—'}</p>
        </div>
      </div>
      {entry.notes && (
        <p className="text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-3">{entry.notes}</p>
      )}
    </div>
  );
}

function OptionCard({ entry }: { entry: CapTableEntry }) {
  const vested = vestedPct(entry);
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.holder_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              {INSTRUMENT_LABEL[entry.instrument]}
            </span>
            {entry.holder_type === 'pool' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-700 text-slate-400">
                POOL
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{fmtShares(entry.shares)}</p>
          <p className="text-[10px] text-slate-500">options</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-0.5">Vesting</p>
          <p className="text-sm text-slate-900 dark:text-white">{vestingDescription(entry)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-0.5">Exercise Price</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{fmtPence(entry.price_per_share_pence)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mb-0.5">Vested</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-1.5 rounded-full bg-purple-500 transition-all"
                style={{ width: `${vested}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-purple-400 tabular-nums">{vested.toFixed(0)}%</span>
          </div>
        </div>
      </div>
      {entry.notes && (
        <p className="text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-3">{entry.notes}</p>
      )}
    </div>
  );
}

function SEISTracker({ entries }: { entries: CapTableEntry[] }) {
  const seisEntries = entries.filter(e => e.seis_eligible);
  const eisEntries = entries.filter(e => e.eis_eligible);
  const seisTotal = seisEntries.reduce((s, e) => s + (e.amount_pence ?? 0), 0);
  const eisTotal = eisEntries.reduce((s, e) => s + (e.amount_pence ?? 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">SEIS / EIS Tracker</h3>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          HMRC COMPLIANCE
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-600 mb-1">SEIS Eligible</p>
          <p className="text-xl font-extrabold text-emerald-400 tabular-nums">{fmtGBP(seisTotal || null)}</p>
          <p className="text-xs text-slate-500 mt-1">{seisEntries.length} holder{seisEntries.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-4">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-sky-600 mb-1">EIS Eligible</p>
          <p className="text-xl font-extrabold text-sky-400 tabular-nums">{fmtGBP(eisTotal || null)}</p>
          <p className="text-xs text-slate-500 mt-1">{eisEntries.length} holder{eisEntries.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="space-y-2">
        {entries.map(entry => (
          (entry.seis_eligible || entry.eis_eligible) && (
            <div key={entry.id} className="flex items-center justify-between py-2 border-t border-slate-200 dark:border-slate-800 first:border-t-0">
              <div>
                <p className="text-sm text-slate-900 dark:text-white">{entry.holder_name}</p>
                <p className="text-xs text-slate-500">{INSTRUMENT_LABEL[entry.instrument]}</p>
              </div>
              <div className="flex items-center gap-2">
                {fmtGBP(entry.amount_pence) !== '—' && (
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{fmtGBP(entry.amount_pence)}</span>
                )}
                {entry.seis_eligible && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">SEIS</span>
                )}
                {entry.eis_eligible && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">EIS</span>
                )}
              </div>
            </div>
          )
        ))}
        {seisEntries.length === 0 && eisEntries.length === 0 && (
          <p className="text-sm text-slate-600 py-2">No SEIS/EIS eligible entries.</p>
        )}
      </div>
    </div>
  );
}

// ── Dilution Modeller ─────────────────────────────────────────────────────────

interface DilutionScenario {
  label:        string;
  preMoney:     number;    // pence
  raiseAmount:  number;    // pence
}

function calcDilution(
  entries: CapTableEntry[],
  fullyDiluted: number,
  preMoney: number,
  raiseAmount: number,
) {
  if (fullyDiluted === 0 || preMoney === 0) return null;

  const postMoney       = preMoney + raiseAmount;
  const pricePerShare   = preMoney / fullyDiluted;  // pence per share
  const newShares       = Math.round(raiseAmount / pricePerShare);
  const newTotal        = fullyDiluted + newShares;
  const investorPct     = (newShares / newTotal) * 100;

  // Group existing holders
  const groups: Record<string, { label: string; shares: number; type: HolderType; beforePct: number; afterPct: number }> = {};
  const typeLabels: Record<HolderType, string> = {
    founder: 'Founders', investor: 'Existing Investors', employee: 'Employees', advisor: 'Advisors', pool: 'Option Pool',
  };
  for (const e of entries) {
    if (!e.shares || isConvertible(e.instrument)) continue;
    const key = e.holder_type;
    if (!groups[key]) groups[key] = { label: typeLabels[e.holder_type], shares: 0, type: e.holder_type, beforePct: 0, afterPct: 0 };
    groups[key].shares += e.shares;
  }
  for (const g of Object.values(groups)) {
    g.beforePct = (g.shares / fullyDiluted) * 100;
    g.afterPct  = (g.shares / newTotal)     * 100;
  }

  return { postMoney, pricePerShare, newShares, newTotal, investorPct, groups: Object.values(groups) };
}

function DilutionModeller({
  entries, totalIssued, fullyDiluted,
}: {
  entries: CapTableEntry[];
  totalIssued: number;
  fullyDiluted: number;
}) {
  const [preMoney,    setPreMoney]    = useState('150000000');   // £1.5m in pence as string
  const [raiseAmount, setRaiseAmount] = useState('15000000');    // £150k
  const [scenarios, setScenarios] = useState<DilutionScenario[]>([]);

  const pm = parseInt(preMoney, 10)  || 0;
  const ra = parseInt(raiseAmount, 10) || 0;

  const result = useMemo(() => calcDilution(entries, fullyDiluted, pm, ra), [entries, fullyDiluted, pm, ra]);

  function saveScenario() {
    if (!result) return;
    const label = `${fmtGBP(ra)} raise @ ${fmtGBP(pm)} pre-money`;
    setScenarios(prev => [{ label, preMoney: pm, raiseAmount: ra }, ...prev].slice(0, 5));
  }

  const PRESET_SCENARIOS: DilutionScenario[] = [
    { label: 'SEIS max (£250k @ £1.5m)',    preMoney: 150_000_000, raiseAmount: 25_000_000  },
    { label: 'Pre-seed (£500k @ £2.5m)',     preMoney: 250_000_000, raiseAmount: 50_000_000  },
    { label: 'Seed (£750k @ £3.5m)',         preMoney: 350_000_000, raiseAmount: 75_000_000  },
    { label: 'Seed+ (£1.5m @ £6m)',          preMoney: 600_000_000, raiseAmount: 150_000_000 },
  ];

  function applyScenario(s: DilutionScenario) {
    setPreMoney(String(s.preMoney));
    setRaiseAmount(String(s.raiseAmount));
  }

  const inputCls = 'w-full bg-white dark:bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors';
  const labelCls = 'block text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5';

  return (
    <div className="space-y-6">
      {/* Warning if no shares */}
      {fullyDiluted === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
          Add shareholders to the cap table first — dilution modelling requires existing fully diluted shares.
        </div>
      )}

      {/* Input panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">New Round Parameters</h3>
            <p className="text-xs text-slate-500 mt-0.5">Model dilution impact of a new investment round on existing holders</p>
          </div>
          <button
            type="button"
            onClick={saveScenario}
            disabled={!result}
            className="px-3.5 py-1.5 text-xs font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40"
          >
            Save scenario
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Pre-Money Valuation (pence)</label>
            <input
              type="number" min="0" step="1000000"
              value={preMoney}
              onChange={e => setPreMoney(e.target.value)}
              className={inputCls}
            />
            <p className="text-[10px] font-mono text-slate-600 mt-1">= {fmtGBP(pm)}</p>
          </div>
          <div>
            <label className={labelCls}>Raise Amount (pence)</label>
            <input
              type="number" min="0" step="1000000"
              value={raiseAmount}
              onChange={e => setRaiseAmount(e.target.value)}
              className={inputCls}
            />
            <p className="text-[10px] font-mono text-slate-600 mt-1">= {fmtGBP(ra)}</p>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] font-mono text-slate-600 self-center">Quick scenarios:</span>
          {PRESET_SCENARIOS.map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => applyScenario(s)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-colors ${
                pm === s.preMoney && ra === s.raiseAmount
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {result && fullyDiluted > 0 && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Post-Money',    value: fmtGBP(result.postMoney),                   color: 'text-amber-400'  },
              { label: 'Price/Share',   value: fmtPence(Math.round(result.pricePerShare)),  color: 'text-slate-900 dark:text-white'      },
              { label: 'New Shares',    value: fmtShares(result.newShares),                 color: 'text-sky-400'    },
              { label: 'Investor %',    value: fmtPct(result.investorPct),                  color: 'text-purple-400' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-center">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
                <p className={`text-xl font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Before / After ownership table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Ownership — Before vs After</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Holder</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Shares</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Before %</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">After %</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {result.groups.map(g => (
                    <tr key={g.type} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${HOLDER_COLORS[g.type]}`} />
                          <span className="text-slate-900 dark:text-white font-medium">{g.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">{fmtShares(g.shares)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300 font-bold">{fmtPct(g.beforePct)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-400 font-bold">{fmtPct(g.afterPct)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-400 font-mono text-[11px]">
                        {fmtPct(g.afterPct - g.beforePct)}
                      </td>
                    </tr>
                  ))}
                  {/* New investor row */}
                  <tr className="bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0 bg-purple-500" />
                        <span className="text-purple-300 font-medium">New Investors (this round)</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-purple-400">{fmtShares(result.newShares)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">—</td>
                    <td className="px-4 py-3 text-right tabular-nums text-purple-400 font-bold">{fmtPct(result.investorPct)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-mono text-[11px]">new</td>
                  </tr>
                  {/* Total row */}
                  <tr className="border-t-2 border-slate-700 bg-slate-50 dark:bg-slate-950">
                    <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">Total (FD post-round)</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900 dark:text-white font-bold">{fmtShares(result.newTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">100.00%</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">100.00%</td>
                    <td className="px-4 py-3 text-right" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual bar before/after */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Ownership Strip — After Round</h4>
            <div className="flex h-7 rounded-lg overflow-hidden w-full">
              {result.groups.map(g => (
                <div
                  key={g.type}
                  className={`${HOLDER_COLORS[g.type]} transition-all`}
                  style={{ width: `${g.afterPct}%`, minWidth: g.afterPct > 2 ? undefined : '2px' }}
                  title={`${g.label}: ${g.afterPct.toFixed(1)}%`}
                />
              ))}
              <div
                className="bg-purple-500 transition-all"
                style={{ width: `${result.investorPct}%`, minWidth: result.investorPct > 2 ? undefined : '2px' }}
                title={`New Investors: ${result.investorPct.toFixed(1)}%`}
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {result.groups.map(g => (
                <div key={g.type} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${HOLDER_COLORS[g.type]} shrink-0`} />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{g.label}</span>
                  <span className={`text-xs font-bold tabular-nums ${HOLDER_TEXT[g.type]}`}>{g.afterPct.toFixed(1)}%</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-purple-500 shrink-0" />
                <span className="text-xs text-slate-600 dark:text-slate-300">New Investors</span>
                <span className="text-xs font-bold tabular-nums text-purple-400">{result.investorPct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved scenarios */}
      {scenarios.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Saved Scenarios</h4>
          <div className="space-y-2">
            {scenarios.map((s, i) => {
              const r = calcDilution(entries, fullyDiluted, s.preMoney, s.raiseAmount);
              return (
                <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-slate-200 dark:border-slate-800 last:border-b-0">
                  <div>
                    <p className="text-sm text-slate-900 dark:text-white">{s.label}</p>
                    {r && <p className="text-xs text-slate-500 font-mono">Post-money: {fmtGBP(r.postMoney)} · Investor: {fmtPct(r.investorPct)}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => applyScenario(s)}
                    className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0 transition-colors"
                  >
                    Load
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export default function CapTableClient({ initialEntries }: { initialEntries: CapTableEntry[] }) {
  const [entries, setEntries] = useState<CapTableEntry[]>(initialEntries);
  const [activeTab, setActiveTab] = useState<'cap-table' | 'instruments' | 'dilution'>('cap-table');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CapTableEntry | undefined>();
  const [deletingId, startDeleting] = useTransition();
  const [copyMsg, setCopyMsg] = useState('');
  const [seeding, setSeeding] = useState(false);

  // ── Derived numbers ────────────────────────────────────────────────────────

  const { totalIssued, poolShares, fullyDiluted, unconvertedCount, ownershipSegments } = useMemo(() => {
    const issued = entries
      .filter(e => e.holder_type !== 'pool' && e.shares && (isEquity(e.instrument) || isOption(e.instrument)))
      .reduce((s, e) => s + (e.shares ?? 0), 0);

    const pool = entries
      .filter(e => e.holder_type === 'pool')
      .reduce((s, e) => s + (e.shares ?? 0), 0);

    const fd = issued + pool;

    const unconv = entries.filter(e => isConvertible(e.instrument)).length;

    // Build segments from equity + option entries (not convertibles, not pool)
    const equityEntries = entries.filter(e => !isConvertible(e.instrument) && e.shares);

    type GroupedSeg = { label: string; shares: number; type: HolderType };
    const grouped: Record<string, GroupedSeg> = {};
    for (const e of equityEntries) {
      const key = e.holder_type;
      if (!grouped[key]) {
        const labels: Record<HolderType, string> = {
          founder: 'Founders',
          investor: 'Investors',
          employee: 'Employees',
          advisor: 'Advisors',
          pool: 'Option Pool',
        };
        grouped[key] = { label: labels[e.holder_type], shares: 0, type: e.holder_type };
      }
      grouped[key].shares += e.shares ?? 0;
    }

    const totalForPct = fd || 1;
    const segs = Object.values(grouped).map(g => ({
      label: g.label,
      pct: (g.shares / totalForPct) * 100,
      color: HOLDER_COLORS[g.type],
      textColor: HOLDER_TEXT[g.type],
    }));

    return {
      totalIssued: issued,
      poolShares: pool,
      fullyDiluted: fd,
      unconvertedCount: unconv,
      ownershipSegments: segs,
    };
  }, [entries]);

  // ── Clipboard ──────────────────────────────────────────────────────────────

  function copyForInvestor() {
    const lines: string[] = ['FLOWEN CAP TABLE — CONFIDENTIAL', '='.repeat(40), ''];
    const groups: { label: string; type: HolderType }[] = [
      { label: 'Founders', type: 'founder' },
      { label: 'Investors', type: 'investor' },
      { label: 'Employees', type: 'employee' },
      { label: 'Advisors', type: 'advisor' },
      { label: 'Option Pool', type: 'pool' },
    ];
    for (const { label, type } of groups) {
      const rows = entries.filter(e => e.holder_type === type);
      if (rows.length === 0) continue;
      lines.push(`${label.toUpperCase()}`);
      for (const e of rows) {
        const pct = e.shares && fullyDiluted > 0 ? ` (${((e.shares / fullyDiluted) * 100).toFixed(1)}% FD)` : '';
        const shares = e.shares ? ` — ${fmtShares(e.shares)} shares` : '';
        const amount = e.amount_pence ? ` — ${fmtGBP(e.amount_pence)}` : '';
        lines.push(`  ${e.holder_name}: ${INSTRUMENT_LABEL[e.instrument]}${shares}${amount}${pct}`);
      }
      lines.push('');
    }
    lines.push(`Total Issued: ${fmtShares(totalIssued)}`);
    lines.push(`Option Pool: ${fmtShares(poolShares)}`);
    lines.push(`Fully Diluted: ${fmtShares(fullyDiluted)}`);
    lines.push('');
    lines.push('Note: Pre-money, pre-conversion figures. Convertible instruments will dilute on conversion.');

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    });
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  function handleSave(entry: CapTableEntry) {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev, entry];
    });
    setShowForm(false);
    setEditingEntry(undefined);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    startDeleting(async () => {
      await apiCall('delete', { id });
      setEntries(prev => prev.filter(e => e.id !== id));
    });
  }

  function handleEdit(entry: CapTableEntry) {
    setEditingEntry(entry);
    setShowForm(true);
  }

  function handleAddNew() {
    setEditingEntry(undefined);
    setShowForm(true);
  }

  async function handleSeed() {
    if (!confirm('Seed with example Flowen cap table data? This adds founders, option pool, and a SAFE note.')) return;
    setSeeding(true);
    const res = await apiCall('seed');
    setSeeding(false);
    if (res.error) { alert(res.error); return; }
    // Reload entries from API
    const fresh = await fetch('/api/admin/cap-table');
    const data = await fresh.json();
    if (data.entries) setEntries(data.entries);
  }

  const convertibleEntries = entries.filter(e => isConvertible(e.instrument));
  const optionEntries = entries.filter(e => isOption(e.instrument));

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
        {([
          { id: 'cap-table',   label: 'Cap Table' },
          { id: 'instruments', label: 'Instruments' },
          { id: 'dilution',    label: 'Dilution Model' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Cap Table ─────────────────────────────────────────── */}
      {activeTab === 'cap-table' && (
        <div className="space-y-6">
          {/* Header actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                CONFIDENTIAL
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyForInvestor}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
                {copyMsg || 'Copy for investor'}
              </button>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-sm font-semibold transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Entry
              </button>
            </div>
          </div>

          {/* Slide-down form */}
          {showForm && (
            <EntryForm
              initial={editingEntry}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingEntry(undefined); }}
            />
          )}

          {/* Ownership strip */}
          {ownershipSegments.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ownership Overview</h3>
              <OwnershipStrip segments={ownershipSegments} />
              <p className="text-xs text-slate-600 italic">
                Percentages are pre-money, pre-conversion. Convertible instruments (SAFEs, loans) will dilute on conversion.
              </p>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Shares Issued"
              value={totalIssued > 0 ? fmtShares(totalIssued) : '0'}
              sub="Excludes option pool"
            />
            <StatCard
              label="Option Pool"
              value={poolShares > 0 ? fmtShares(poolShares) : '0'}
              sub="Reserved but unissued"
            />
            <StatCard
              label="Fully Diluted Total"
              value={fullyDiluted > 0 ? fmtShares(fullyDiluted) : '0'}
              sub="Issued + pool"
            />
            <StatCard
              label="Unconverted Instruments"
              value={unconvertedCount.toString()}
              sub="SAFEs / convertibles"
            />
          </div>

          {/* Holdings table */}
          {entries.length > 0 ? (
            <HoldingsTable
              entries={entries}
              totalIssued={totalIssued}
              fullyDiluted={fullyDiluted}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
              <p className="text-slate-500 text-sm">No cap table entries yet.</p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={handleAddNew}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white text-sm font-semibold transition-colors"
                >
                  Add First Entry
                </button>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {seeding ? 'Seeding…' : '⚡ Seed example data'}
                </button>
              </div>
              <p className="text-xs text-slate-700">Seed adds founders, EMI pool, and example SAFE note</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Dilution Model ────────────────────────────────────── */}
      {activeTab === 'dilution' && (
        <DilutionModeller
          entries={entries}
          totalIssued={totalIssued}
          fullyDiluted={fullyDiluted}
        />
      )}

      {/* ── TAB 2: Instruments ───────────────────────────────────────── */}
      {activeTab === 'instruments' && (
        <div className="space-y-8">

          {/* Convertible Instruments */}
          {convertibleEntries.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Convertible Instruments</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {convertibleEntries.length} instrument{convertibleEntries.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {convertibleEntries.map(e => (
                  <ConvertibleCard key={e.id} entry={e} />
                ))}
              </div>
            </div>
          )}

          {/* EMI / Option Grants */}
          {optionEntries.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Options &amp; Warrants</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  {optionEntries.length} grant{optionEntries.length !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Pool summary */}
              {(() => {
                const poolEntry = entries.find(e => e.holder_type === 'pool' && isOption(e.instrument));
                const grantedShares = optionEntries
                  .filter(e => e.holder_type !== 'pool')
                  .reduce((s, e) => s + (e.shares ?? 0), 0);
                const totalPool = poolEntry?.shares ?? 0;
                const ungranted = totalPool - grantedShares;
                if (!poolEntry) return null;
                return (
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-600 mb-1">Pool Size</p>
                        <p className="text-lg font-extrabold text-purple-400">{fmtShares(totalPool)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-600 mb-1">Granted</p>
                        <p className="text-lg font-extrabold text-slate-900 dark:text-white">{fmtShares(grantedShares)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-purple-600 mb-1">Ungranted</p>
                        <p className="text-lg font-extrabold text-emerald-400">{fmtShares(ungranted)}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {optionEntries.map(e => (
                  <OptionCard key={e.id} entry={e} />
                ))}
              </div>
            </div>
          )}

          {/* SEIS/EIS Tracker */}
          <SEISTracker entries={entries} />

          {convertibleEntries.length === 0 && optionEntries.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
              <p className="text-slate-500 text-sm">No convertible instruments or options recorded yet.</p>
              <p className="text-slate-600 text-xs mt-1">Switch to the Cap Table tab to add entries.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
