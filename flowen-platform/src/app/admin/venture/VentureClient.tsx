'use client';

import React, { useState, useTransition } from 'react';
import type { VentureData, Investor, VentureConfig } from '@/app/api/admin/venture/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pence(p: number | null | undefined, fallback = '—'): string {
  if (p == null) return fallback;
  if (p === 0) return '£0';
  if (p >= 100_000_00) return `£${(p / 100_000_00).toFixed(1)}m`;
  if (p >= 100_000)    return `£${(p / 100_000).toFixed(0)}k`.replace(/(\d)(?=(\d{3})+k)/, '$1,');
  return `£${(p / 100).toLocaleString('en-GB')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/venture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ data?: unknown; error?: string; ok?: boolean }>;
}

// ── Stage config ──────────────────────────────────────────────────────────────

type Stage = 'researched' | 'contacted' | 'warm' | 'in_diligence' | 'term_sheet' | 'committed' | 'passed' | 'on_hold';

const STAGE_CONFIG: Record<Stage, { label: string; badge: string }> = {
  researched:   { label: 'Researched',   badge: 'bg-slate-700 text-slate-600 dark:text-slate-300' },
  contacted:    { label: 'Contacted',    badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  warm:         { label: 'Warm',         badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/30' },
  in_diligence: { label: 'In Diligence', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  term_sheet:   { label: 'Term Sheet',   badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
  committed:    { label: 'Committed',    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  passed:       { label: 'Passed',       badge: 'bg-red-900/30 text-red-500/70' },
  on_hold:      { label: 'On Hold',      badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500' },
};

const ALL_STAGES = Object.keys(STAGE_CONFIG) as Stage[];

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-mono shadow-xl border ${
      kind === 'success'
        ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
        : 'bg-red-950 border-red-800 text-red-300'
    }`}>
      {message}
    </div>
  );
}

// ── Input helpers ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 2 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────

type Tab = 'round' | 'investors' | 'kpis' | 'updates' | 'runway';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'round',     label: 'Round' },
    { id: 'investors', label: 'Investors Pipeline' },
    { id: 'kpis',      label: 'KPI Board' },
    { id: 'updates',   label: 'Updates' },
    { id: 'runway',    label: 'Runway' },
  ];
  return (
    <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 text-sm font-mono rounded-lg transition-colors ${
            active === t.id
              ? 'bg-slate-700 text-slate-900 dark:text-white font-bold'
              : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Round Tab ─────────────────────────────────────────────────────────────────

const ROUND_TYPES = [
  { value: 'pre_seed',    label: 'Pre-Seed' },
  { value: 'seed',        label: 'Seed' },
  { value: 'seed_bridge', label: 'Seed Bridge' },
  { value: 'series_a',    label: 'Series A' },
];

const INSTRUMENTS = [
  { value: 'safe',             label: 'SAFE' },
  { value: 'convertible_note', label: 'Convertible Note' },
  { value: 'equity',           label: 'Equity' },
];

function roundTypeLabel(v: string | null): string {
  if (!v) return '—';
  return ROUND_TYPES.find(r => r.value === v)?.label ?? v;
}

function roundTypeBadge(v: string | null): string {
  if (v === 'pre_seed') return 'PRE-SEED';
  if (v === 'seed_bridge') return 'SEED BRIDGE';
  if (v === 'seed') return 'SEED';
  if (v === 'series_a') return 'SERIES A';
  return v?.toUpperCase() ?? '—';
}

type ConfigForm = {
  round_type: string;
  target_raise_pence: string;
  committed_pence: string;
  valuation_cap_pence: string;
  instrument: string;
  seis_advance_assurance: boolean;
  seis_limit_remaining_pence: string;
  eis_eligible: boolean;
  notes: string;
};

function configToForm(c: VentureConfig | null): ConfigForm {
  return {
    round_type:                  c?.round_type ?? 'seed',
    target_raise_pence:          c?.target_raise_pence != null ? String(Math.round(c.target_raise_pence / 100)) : '',
    committed_pence:             c?.committed_pence != null ? String(Math.round(c.committed_pence / 100)) : '',
    valuation_cap_pence:         c?.valuation_cap_pence != null ? String(Math.round(c.valuation_cap_pence / 100)) : '',
    instrument:                  c?.instrument ?? 'safe',
    seis_advance_assurance:      c?.seis_advance_assurance ?? false,
    seis_limit_remaining_pence:  c?.seis_limit_remaining_pence != null ? String(Math.round(c.seis_limit_remaining_pence / 100)) : '',
    eis_eligible:                c?.eis_eligible ?? false,
    notes:                       c?.notes ?? '',
  };
}

function formToConfigPayload(f: ConfigForm): Record<string, unknown> {
  return {
    action: 'update_config',
    round_type: f.round_type,
    target_raise_pence:         f.target_raise_pence         ? Math.round(parseFloat(f.target_raise_pence) * 100)         : null,
    committed_pence:            f.committed_pence            ? Math.round(parseFloat(f.committed_pence) * 100)            : null,
    valuation_cap_pence:        f.valuation_cap_pence        ? Math.round(parseFloat(f.valuation_cap_pence) * 100)        : null,
    instrument: f.instrument,
    seis_advance_assurance:     f.seis_advance_assurance,
    seis_limit_remaining_pence: f.seis_limit_remaining_pence ? Math.round(parseFloat(f.seis_limit_remaining_pence) * 100) : null,
    eis_eligible: f.eis_eligible,
    notes: f.notes || null,
  };
}

function RoundTab({
  config,
  onConfigUpdate,
  showToast,
}: {
  config: VentureConfig | null;
  onConfigUpdate: (c: VentureConfig) => void;
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ConfigForm>(() => configToForm(config));
  const [isPending, startTransition] = useTransition();

  function field<K extends keyof ConfigForm>(k: K, v: ConfigForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function startEdit() {
    setForm(configToForm(config));
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setForm(configToForm(config));
  }

  function save() {
    startTransition(async () => {
      const res = await apiPost(formToConfigPayload(form));
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onConfigUpdate(res.data as VentureConfig);
      setEditing(false);
      showToast('Round config updated', 'success');
    });
  }

  const pctCommitted = config?.target_raise_pence && config?.committed_pence
    ? Math.min(100, Math.round((config.committed_pence / config.target_raise_pence) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 tracking-widest">
              {roundTypeBadge(config?.round_type ?? null)}
            </span>
            {config?.instrument && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-700">
                {INSTRUMENTS.find(i => i.value === config.instrument)?.label ?? config.instrument}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="px-4 py-2 text-xs font-mono font-bold rounded-xl border border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors"
          >
            Edit Round
          </button>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Target Raise</p>
            <p className="text-3xl font-black text-amber-400">{pence(config?.target_raise_pence, '—')}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Committed</p>
            <p className="text-3xl font-black text-emerald-400">{pence(config?.committed_pence, '£0')}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Valuation Cap</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{pence(config?.valuation_cap_pence, '—')}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Round Type</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{roundTypeLabel(config?.round_type ?? null)}</p>
          </div>
        </div>

        {/* Progress bar */}
        {config?.target_raise_pence ? (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-mono text-slate-500">Funding Progress</p>
              <p className="text-[10px] font-mono text-amber-400 font-bold">{pctCommitted}%</p>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${pctCommitted}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[9px] font-mono text-slate-600">{pence(config.committed_pence, '£0')} committed</p>
              <p className="text-[9px] font-mono text-slate-600">{pence(config.target_raise_pence)} target</p>
            </div>
          </div>
        ) : null}

        {/* SEIS / EIS badges */}
        <div className="flex flex-wrap gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            config?.seis_advance_assurance
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-700 text-slate-500'
          }`}>
            <span className="text-sm">{config?.seis_advance_assurance ? '✓' : '◌'}</span>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wide">SEIS Advance Assurance</p>
              {config?.seis_advance_assurance
                ? <p className="text-[9px] font-mono opacity-70">Confirmed</p>
                : <p className="text-[9px] font-mono opacity-50">Pending</p>}
            </div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            config?.eis_eligible
              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
              : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-700 text-slate-500'
          }`}>
            <span className="text-sm">{config?.eis_eligible ? '✓' : '◌'}</span>
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wide">EIS Eligible</p>
              <p className="text-[9px] font-mono opacity-70">
                {config?.eis_eligible ? 'Confirmed' : 'Not confirmed'}
              </p>
            </div>
          </div>
          {config?.seis_limit_remaining_pence != null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-400">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wide">SEIS Limit Remaining</p>
                <p className="text-lg font-black">{pence(config.seis_limit_remaining_pence)}</p>
              </div>
            </div>
          )}
        </div>

        {config?.notes && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1.5">Notes</p>
            <p className="text-sm text-slate-400 leading-relaxed">{config.notes}</p>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5">Edit Round Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <Label>Round Type</Label>
              <Select value={form.round_type} onChange={v => field('round_type', v)} options={ROUND_TYPES} />
            </div>
            <div>
              <Label>Instrument</Label>
              <Select value={form.instrument} onChange={v => field('instrument', v)} options={INSTRUMENTS} />
            </div>
            <div>
              <Label>Target Raise (£)</Label>
              <Input value={form.target_raise_pence} onChange={v => field('target_raise_pence', v)} placeholder="e.g. 750000" type="number" />
            </div>
            <div>
              <Label>Committed (£)</Label>
              <Input value={form.committed_pence} onChange={v => field('committed_pence', v)} placeholder="e.g. 150000" type="number" />
            </div>
            <div>
              <Label>Valuation Cap (£)</Label>
              <Input value={form.valuation_cap_pence} onChange={v => field('valuation_cap_pence', v)} placeholder="e.g. 5000000" type="number" />
            </div>
            <div>
              <Label>SEIS Limit Remaining (£)</Label>
              <Input value={form.seis_limit_remaining_pence} onChange={v => field('seis_limit_remaining_pence', v)} placeholder="e.g. 150000" type="number" />
            </div>
          </div>
          <div className="flex gap-6 mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.seis_advance_assurance}
                onChange={e => field('seis_advance_assurance', e.target.checked)}
                className="w-4 h-4 rounded border border-slate-600 bg-slate-100 dark:bg-slate-800 accent-amber-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">SEIS Advance Assurance</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.eis_eligible}
                onChange={e => field('eis_eligible', e.target.checked)}
                className="w-4 h-4 rounded border border-slate-600 bg-slate-100 dark:bg-slate-800 accent-sky-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">EIS Eligible</span>
            </label>
          </div>
          <div className="mb-5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={v => field('notes', v)} placeholder="Round notes, terms, conditions..." rows={3} />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-40"
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Grant & Debt section */}
      <div>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono mb-4">Grant &amp; Debt</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Innovate UK</p>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">EXPLORING</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Innovate UK Smart Grants and SBRI programmes for AI / healthtech. Next deadline: TBC.
            </p>
            <p className="text-[10px] font-mono text-slate-600 mt-3">Typical award: £50k – £500k</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-900 dark:text-white">SEIS / EIS Relief</p>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">IN PROGRESS</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              SEIS up to £250k at 50% income tax relief. EIS up to £12m for qualifying investors.
            </p>
            <p className="text-[10px] font-mono text-amber-500/60 mt-3">Advance assurance application pending</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Debt / Revenue Loans</p>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-slate-700 text-slate-400">NOT STARTED</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              British Business Bank Start Up Loans, Uncapped, Clearco. Revenue-based financing options once MRR grows.
            </p>
            <p className="text-[10px] font-mono text-slate-600 mt-3">Target: post product-market fit</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Investor Form ─────────────────────────────────────────────────────────────

type InvestorForm = {
  name: string;
  firm: string;
  email: string;
  stage: Stage;
  amount_pounds: string;
  last_contact_at: string;
  next_action: string;
  notes: string;
};

function blankForm(): InvestorForm {
  return { name: '', firm: '', email: '', stage: 'researched', amount_pounds: '', last_contact_at: '', next_action: '', notes: '' };
}

function investorToForm(inv: Investor): InvestorForm {
  return {
    name:            inv.name,
    firm:            inv.firm            ?? '',
    email:           inv.email           ?? '',
    stage:           (inv.stage as Stage) ?? 'researched',
    amount_pounds:   inv.amount_pence != null ? String(Math.round(inv.amount_pence / 100)) : '',
    last_contact_at: inv.last_contact_at ? inv.last_contact_at.slice(0, 10) : '',
    next_action:     inv.next_action     ?? '',
    notes:           inv.notes           ?? '',
  };
}

function formToInvestorPayload(f: InvestorForm): Record<string, unknown> {
  return {
    name:            f.name,
    firm:            f.firm            || null,
    email:           f.email           || null,
    stage:           f.stage,
    amount_pence:    f.amount_pounds   ? Math.round(parseFloat(f.amount_pounds) * 100) : null,
    last_contact_at: f.last_contact_at || null,
    next_action:     f.next_action     || null,
    notes:           f.notes           || null,
  };
}

function InvestorFormPanel({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: InvestorForm;
  onSave: (f: InvestorForm) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<InvestorForm>(initial);
  function field<K extends keyof InvestorForm>(k: K, v: InvestorForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-sky-500/20 rounded-2xl p-5 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <Label>Name *</Label>
          <Input value={form.name} onChange={v => field('name', v)} placeholder="First Last" />
        </div>
        <div>
          <Label>Firm</Label>
          <Input value={form.firm} onChange={v => field('firm', v)} placeholder="VC / Angel" />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={v => field('email', v)} placeholder="investor@example.com" type="email" />
        </div>
        <div>
          <Label>Stage</Label>
          <Select
            value={form.stage}
            onChange={v => field('stage', v as Stage)}
            options={ALL_STAGES.map(s => ({ value: s, label: STAGE_CONFIG[s].label }))}
          />
        </div>
        <div>
          <Label>Cheque Size (£)</Label>
          <Input value={form.amount_pounds} onChange={v => field('amount_pounds', v)} placeholder="e.g. 50000" type="number" />
        </div>
        <div>
          <Label>Last Contact</Label>
          <Input value={form.last_contact_at} onChange={v => field('last_contact_at', v)} type="date" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Next Action</Label>
          <Input value={form.next_action} onChange={v => field('next_action', v)} placeholder="e.g. Send deck, Follow up" />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={v => field('notes', v)} placeholder="Meeting notes, preferences..." />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending || !form.name}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save Investor'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Stage badge ───────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage as Stage] ?? { label: stage, badge: 'bg-slate-700 text-slate-600 dark:text-slate-300' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

// ── Investors Tab ─────────────────────────────────────────────────────────────

type StageFilter = 'all' | 'warm' | 'in_diligence' | 'committed' | 'passed';

const STAGE_FILTERS: { id: StageFilter; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'warm',         label: 'Warm' },
  { id: 'in_diligence', label: 'In Diligence' },
  { id: 'committed',    label: 'Committed' },
  { id: 'passed',       label: 'Passed' },
];

function InvestorsTab({
  investors,
  onAdd,
  onUpdate,
  onDelete,
  showToast,
}: {
  investors: Investor[];
  onAdd: (inv: Investor) => void;
  onUpdate: (inv: Investor) => void;
  onDelete: (id: string) => void;
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const [filter, setFilter] = useState<StageFilter>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = filter === 'all' ? investors : investors.filter(i => i.stage === filter);

  const pipelineValue = investors
    .filter(i => i.stage !== 'passed' && i.amount_pence != null)
    .reduce((sum, i) => sum + (i.amount_pence ?? 0), 0);

  function handleAdd(form: InvestorForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'add_investor', ...formToInvestorPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onAdd(res.data as Investor);
      setShowAddForm(false);
      showToast('Investor added', 'success');
    });
  }

  function handleUpdate(id: string, form: InvestorForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'update_investor', id, ...formToInvestorPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onUpdate(res.data as Investor);
      setEditingId(null);
      showToast('Investor updated', 'success');
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await apiPost({ action: 'delete_investor', id });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onDelete(id);
      showToast('Investor removed', 'success');
    });
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {STAGE_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
                filter === f.id
                  ? 'bg-sky-600 text-slate-900 dark:text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f.label}
              {f.id !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  ({investors.filter(i => i.stage === f.id).length})
                </span>
              )}
              {f.id === 'all' && <span className="ml-1.5 opacity-60">({investors.length})</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {pipelineValue > 0 && (
            <p className="text-[11px] font-mono text-slate-500">
              Pipeline: <span className="text-sky-400 font-bold">{pence(pipelineValue)}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
            className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-slate-900 dark:text-white transition-colors"
          >
            {showAddForm ? 'Cancel' : '+ Add Investor'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <InvestorFormPanel
          initial={blankForm()}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={isPending}
        />
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-16 text-center">
          <p className="text-slate-600 font-mono text-sm">
            {investors.length === 0 ? 'No investors yet — add your first one above' : 'No investors in this stage'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Name / Firm</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Cheque</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Stage</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell">Last Contact</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden xl:table-cell">Next Action</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map(inv => (
                  <React.Fragment key={inv.id}>
                    <tr className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{inv.name}</p>
                        {inv.firm && <p className="text-[11px] font-mono text-slate-500">{inv.firm}</p>}
                        {inv.email && <p className="text-[10px] text-slate-600">{inv.email}</p>}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <p className="text-sm font-mono font-bold text-amber-400">{pence(inv.amount_pence, '—')}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StageBadge stage={inv.stage} />
                      </td>
                      <td className="px-4 py-3.5 text-[11px] font-mono text-slate-500 hidden lg:table-cell">
                        {fmtDate(inv.last_contact_at)}
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell max-w-[200px]">
                        {inv.next_action
                          ? <p className="text-[11px] text-slate-400 truncate">{inv.next_action}</p>
                          : <p className="text-[11px] text-slate-700">—</p>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setEditingId(id => id === inv.id ? null : inv.id)}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(inv.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === inv.id && (
                      <tr>
                        <td colSpan={6} className="px-5 py-4 bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                          <InvestorFormPanel
                            initial={investorToForm(inv)}
                            onSave={form => handleUpdate(inv.id, form)}
                            onCancel={() => setEditingId(null)}
                            isPending={isPending}
                          />
                        </td>
                      </tr>
                    )}
                    {inv.notes && !editingId && (
                      <tr className="hidden group-hover:table-row">
                        <td colSpan={6} className="px-5 pb-3 -mt-2">
                          <p className="text-[10px] font-mono text-slate-600 italic">{inv.notes}</p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Tab ───────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'amber' | 'emerald' | 'sky' | 'white';
}

function KpiCard({ label, value, sub, accent = 'white' }: KpiCardProps) {
  const colorMap = {
    amber:   'text-amber-400',
    emerald: 'text-emerald-400',
    sky:     'text-sky-400',
    white:   'text-slate-900 dark:text-white',
  };
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-black ${colorMap[accent]}`}>{value}</p>
      {sub && <p className="text-[11px] font-mono text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

const MILESTONES = [
  { date: "Q3 '26", label: 'Pre-pay Locks',  status: 'done',     note: 'Founding tier live' },
  { date: "Q4 '26", label: 'Native Apps',    status: 'active',   note: 'iOS + Android' },
  { date: "Q2 '27", label: 'NHS Pledges',    status: 'upcoming', note: 'NHS partnership' },
  { date: "Q4 '27", label: 'Series A',       status: 'upcoming', note: '£5m target' },
];

function MilestoneTimeline() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-6">Milestone Timeline</h3>
      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-4 top-5 bottom-5 w-px bg-slate-100 dark:bg-slate-800" />
        <div className="space-y-5">
          {MILESTONES.map((m, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
                m.status === 'done'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : m.status === 'active'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-600'
              }`}>
                {m.status === 'done' ? (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 8 6 11 13 5" /></svg>
                ) : m.status === 'active' ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 block" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 block" />
                )}
              </div>
              <div className="flex-1 pt-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-600">{m.date}</span>
                  <span className={`text-sm font-bold ${
                    m.status === 'done' ? 'text-slate-900 dark:text-white' : m.status === 'active' ? 'text-amber-300' : 'text-slate-500'
                  }`}>{m.label}</span>
                  {m.status === 'done' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400">DONE</span>
                  )}
                  {m.status === 'active' && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400">ACTIVE</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 font-mono mt-0.5">{m.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiBoard({
  kpis,
  investors,
  config,
}: {
  kpis: VentureData['kpis'];
  investors: Investor[];
  config: VentureConfig | null;
}) {
  const [copied, setCopied] = useState(false);
  const now = new Date();

  const mrrDisplay = kpis.mrrPence > 0 ? pence(kpis.mrrPence) : 'Pre-revenue';
  const arrDisplay = kpis.mrrPence > 0 ? pence(kpis.mrrPence * 12) : 'Pre-revenue';
  const foundingGoal = 500;
  const foundingPct = Math.round((kpis.foundingCount / foundingGoal) * 100);
  const weeklyGrowth = kpis.totalUsers > 0
    ? `+${((kpis.newUsersWeek / kpis.totalUsers) * 100).toFixed(1)}%`
    : '—';

  const committedCount = investors.filter(i => i.stage === 'committed').length;
  const pipelineTotal  = investors
    .filter(i => i.stage !== 'passed' && i.amount_pence != null)
    .reduce((s, i) => s + (i.amount_pence ?? 0), 0);

  function buildSummary(): string {
    const lines = [
      `FLOWEN — Investor Update (${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })})`,
      '',
      `ROUND: ${roundTypeBadge(config?.round_type ?? null)} via ${config?.instrument?.toUpperCase() ?? 'SAFE'}`,
      `Target: ${pence(config?.target_raise_pence)}  |  Committed: ${pence(config?.committed_pence, '£0')}`,
      `Valuation Cap: ${pence(config?.valuation_cap_pence)}`,
      '',
      'KEY METRICS',
      `Total Users:       ${kpis.totalUsers.toLocaleString()}`,
      `New Users (7d):    +${kpis.newUsersWeek}`,
      `Founding Members:  ${kpis.foundingCount} / ${foundingGoal} goal (${foundingPct}%)`,
      `Waitlist:          ${kpis.waitlistTotal.toLocaleString()}`,
      `MRR:               ${mrrDisplay}`,
      `ARR:               ${arrDisplay}`,
      `Onboarding Rate:   ${kpis.onboardedPct}%`,
      `Weekly Growth:     ${weeklyGrowth}`,
      '',
      'INVESTOR PIPELINE',
      `Committed Investors: ${committedCount}`,
      `Pipeline Value:      ${pence(pipelineTotal)}`,
      '',
      'MILESTONES',
      `✓ Q3 '26 — Pre-pay Locks (Founding tier live)`,
      `→ Q4 '26 — Native Apps (iOS + Android)`,
      `  Q2 '27 — NHS Pledges`,
      `  Q4 '27 — Series A (£5m target)`,
    ];
    return lines.join('\n');
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(buildSummary()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Investor-Facing Metrics</h2>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">Last updated: {fmtDateTime(now.toISOString())}</p>
        </div>
        <button
          type="button"
          onClick={copyToClipboard}
          className={`px-4 py-2 text-xs font-mono font-bold rounded-xl border transition-colors ${
            copied
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
              : 'border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-600'
          }`}
        >
          {copied ? '✓ Copied!' : 'Copy Investor Summary'}
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Users"
          value={kpis.totalUsers.toLocaleString()}
          sub={kpis.newUsersWeek > 0 ? `+${kpis.newUsersWeek} this week` : 'No new signups'}
          accent="white"
        />
        <KpiCard
          label="MRR"
          value={mrrDisplay}
          sub={kpis.mrrPence > 0 ? `ARR: ${arrDisplay}` : 'Growing via founding tier'}
          accent="amber"
        />
        <KpiCard
          label="Founding Members"
          value={String(kpis.foundingCount)}
          sub={`${foundingPct}% of ${foundingGoal} goal`}
          accent="emerald"
        />
        <KpiCard
          label="Waitlist Total"
          value={kpis.waitlistTotal.toLocaleString()}
          sub="Organic signups"
          accent="sky"
        />
        <KpiCard
          label="Weekly Growth Rate"
          value={weeklyGrowth}
          sub={`${kpis.newUsersWeek} new users past 7 days`}
          accent="sky"
        />
        <KpiCard
          label="Onboarding Rate"
          value={`${kpis.onboardedPct}%`}
          sub="Users who completed onboarding"
          accent={kpis.onboardedPct >= 60 ? 'emerald' : 'amber'}
        />
        <KpiCard
          label="Committed Investors"
          value={String(committedCount)}
          sub={committedCount > 0 ? 'Term sheets / commitments' : 'Pipeline being built'}
          accent={committedCount > 0 ? 'emerald' : 'white'}
        />
        <KpiCard
          label="Pipeline Value"
          value={pipelineTotal > 0 ? pence(pipelineTotal) : '—'}
          sub="Excl. passed investors"
          accent="amber"
        />
      </div>

      {/* Round snapshot */}
      {config && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-4">Current Round</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-mono text-slate-500 mb-1">Round</p>
              <p className="text-sm font-bold text-amber-400">{roundTypeLabel(config.round_type)}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-500 mb-1">Target</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{pence(config.target_raise_pence, '—')}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-500 mb-1">Committed</p>
              <p className="text-sm font-bold text-emerald-400">{pence(config.committed_pence, '£0')}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-500 mb-1">Instrument</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{INSTRUMENTS.find(i => i.value === config.instrument)?.label ?? config.instrument ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <MilestoneTimeline />
    </div>
  );
}

// ── Investor Updates Tab ──────────────────────────────────────────────────────

interface UpdateKpis {
  users: number;
  sessions30d: number;
  nhs_stage: string;
  grants_submitted: number;
}

interface InvestorUpdateRecord {
  id: string;
  subject: string;
  body: string;
  sent_at: string;
  recipient_count: number;
}

function UpdatesTab({ investors }: { investors: Investor[] }) {
  const now = new Date();
  const defaultSubject = `Flowen Update — ${now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;

  const [kpis, setKpis] = React.useState<UpdateKpis | null>(null);
  const [draft, setDraft] = React.useState('');
  const [subject, setSubject] = React.useState(defaultSubject);
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState('');

  // Recipients: investors with status committed / in_diligence / warm who have email
  const defaultRecipients = investors
    .filter(i => ['committed', 'in_diligence', 'warm'].includes(i.stage) && i.email)
    .map(i => i.email as string);
  const [recipientInput, setRecipientInput] = React.useState(defaultRecipients.join(', '));

  const [sending, setSending] = React.useState(false);
  const [sendStatus, setSendStatus] = React.useState<{ ok: boolean; message: string } | null>(null);

  const [history, setHistory] = React.useState<InvestorUpdateRecord[]>([]);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Load history on mount
  React.useEffect(() => {
    fetch('/api/admin/venture/investor-update?action=history')
      .then(r => r.json())
      .then(d => {
        setHistory(d.updates ?? []);
        setHistoryLoaded(true);
      })
      .catch(() => setHistoryLoaded(true));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError('');
    setDraft('');
    setKpis(null);
    setSendStatus(null);
    try {
      const res = await fetch('/api/admin/venture/investor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft' }),
      });
      const data = await res.json() as { draft?: string; kpis?: UpdateKpis; error?: string };
      if (data.error) { setGenerateError(data.error); return; }
      setDraft(data.draft ?? '');
      setKpis(data.kpis ?? null);
    } catch {
      setGenerateError('Network error — could not reach the server');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    const emails = recipientInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!emails.length) { setSendStatus({ ok: false, message: 'No recipient emails' }); return; }
    if (!subject.trim()) { setSendStatus({ ok: false, message: 'Subject is required' }); return; }
    if (!draft.trim()) { setSendStatus({ ok: false, message: 'Draft is empty' }); return; }

    setSending(true);
    setSendStatus(null);
    try {
      const res = await fetch('/api/admin/venture/investor-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', subject, body: draft, recipient_emails: emails }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; mock?: boolean; note?: string };
      if (data.error) {
        setSendStatus({ ok: false, message: data.error });
      } else if (data.mock) {
        setSendStatus({ ok: true, message: `Mock send — ${data.note ?? 'Resend not configured'}` });
      } else {
        setSendStatus({ ok: true, message: `Sent to ${emails.length} investor${emails.length !== 1 ? 's' : ''} via BCC` });
        // Refresh history
        fetch('/api/admin/venture/investor-update?action=history')
          .then(r => r.json())
          .then(d => setHistory(d.updates ?? []))
          .catch(() => {});
      }
    } catch {
      setSendStatus({ ok: false, message: 'Network error — send failed' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Investor Updates</h2>
        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-violet-500/15 text-violet-400 border border-violet-500/30 tracking-widest">
          AI-DRAFTED
        </span>
      </div>

      {/* KPI snapshot strip — shown after generation */}
      {(kpis || generating) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {generating ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse">
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-20 mb-3" />
                <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded w-12" />
              </div>
            ))
          ) : kpis ? (
            <>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Total Users</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{kpis.users.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Sessions (30d)</p>
                <p className="text-2xl font-black text-sky-400">{kpis.sessions30d.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">NHS Pipeline</p>
                <p className="text-sm font-bold text-emerald-400 leading-tight">{kpis.nhs_stage}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Grants Submitted</p>
                <p className="text-2xl font-black text-amber-400">{kpis.grants_submitted}</p>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Draft panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Draft Update</h3>
            <p className="text-[11px] font-mono text-slate-500">Pull live data and generate a draft with Claude</p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
          >
            {generating ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin" />
                Consulting live data...
              </>
            ) : (
              'Generate Update'
            )}
          </button>
        </div>

        {generateError && (
          <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3">
            <p className="text-sm font-mono text-red-400">{generateError}</p>
          </div>
        )}

        {generating && !draft && (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded" style={{ width: `${75 + (i % 3) * 8}%` }} />
            ))}
          </div>
        )}

        {draft && (
          <div className="space-y-4">
            <div>
              <Label>Draft Body (editable)</Label>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={20}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 font-mono leading-relaxed whitespace-pre-wrap focus:outline-none focus:border-amber-500/50 resize-y"
              />
            </div>
            <div>
              <Label>Subject Line</Label>
              <Input value={subject} onChange={setSubject} placeholder="Flowen Update — July 2026" />
            </div>
          </div>
        )}
      </div>

      {/* Send panel — shown after draft is ready */}
      {draft && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">Send Update</h3>
            <p className="text-[11px] font-mono text-slate-500">
              Pre-filled with investors in Committed, In Diligence, and Warm stages who have an email address
            </p>
          </div>

          <div>
            <Label>Recipient Emails (comma-separated)</Label>
            <textarea
              value={recipientInput}
              onChange={e => setRecipientInput(e.target.value)}
              rows={3}
              placeholder="investor1@example.com, investor2@example.com"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 font-mono focus:outline-none focus:border-amber-500/50 resize-none"
            />
            <p className="text-[10px] font-mono text-slate-600 mt-1.5">
              Sent as BCC — each investor receives it individually. Their addresses are not visible to each other.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
            >
              {sending ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Update'
              )}
            </button>

            {sendStatus && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono border ${
                sendStatus.ok
                  ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
                  : 'bg-red-950/40 border-red-800/50 text-red-400'
              }`}>
                <span>{sendStatus.ok ? '✓' : '✗'}</span>
                <span>{sendStatus.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Update history */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Update History</h3>
        </div>

        {!historyLoaded ? (
          <div className="py-12 text-center">
            <p className="text-slate-600 font-mono text-sm animate-pulse">Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-600 font-mono text-sm">No updates sent yet</p>
            <p className="text-slate-700 font-mono text-xs mt-1">Generate and send your first investor update above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Subject</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden sm:table-cell">Recipients</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {history.map(update => (
                  <React.Fragment key={update.id}>
                    <tr className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                        {new Date(update.sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-900 dark:text-white max-w-[280px] truncate">{update.subject}</td>
                      <td className="px-4 py-3.5 text-[11px] font-mono text-slate-500 hidden sm:table-cell">{update.recipient_count}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(id => id === update.id ? null : update.id)}
                          className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors"
                        >
                          {expandedId === update.id ? 'Collapse' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === update.id && (
                      <tr>
                        <td colSpan={4} className="px-5 py-4 bg-slate-100 dark:bg-slate-950/60">
                          <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                            {update.body}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Runway Tab ────────────────────────────────────────────────────────────────

function pencePounds(p: number | null | undefined): string {
  if (p == null) return '';
  return String(Math.round(p / 100));
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function runwayColour(months: number): string {
  if (months > 12) return 'text-emerald-400';
  if (months > 6)  return 'text-amber-400';
  if (months > 3)  return 'text-orange-400';
  return 'text-red-400';
}

function runwayBorderColour(months: number): string {
  if (months > 12) return 'border-emerald-500/30';
  if (months > 6)  return 'border-amber-500/30';
  if (months > 3)  return 'border-orange-500/30';
  return 'border-red-500/40';
}

function runwayBgColour(months: number): string {
  if (months > 12) return 'bg-emerald-500/10';
  if (months > 6)  return 'bg-amber-500/10';
  if (months > 3)  return 'bg-orange-500/10';
  return 'bg-red-500/10';
}

interface RunwayRow {
  month: number;
  label: string;
  opening: number;
  burn: number;
  closing: number;
  goesNegative: boolean;
}

function buildCashFlowTable(cashPence: number, burnPence: number, today: Date): RunwayRow[] {
  const rows: RunwayRow[] = [];
  let balance = cashPence;
  for (let i = 0; i < 12; i++) {
    const date = addMonths(today, i + 1);
    const label = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    const opening = balance;
    const closing = opening - burnPence;
    rows.push({
      month: i + 1,
      label,
      opening,
      burn: burnPence,
      closing,
      goesNegative: closing < 0,
    });
    balance = closing;
    if (closing <= 0) break;
  }
  // Pad to 12 rows with greyed-out zeros if we ran out of cash early
  const filled = rows.length;
  for (let i = filled; i < 12; i++) {
    const date = addMonths(today, i + 1);
    const label = date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    rows.push({ month: i + 1, label, opening: 0, burn: burnPence, closing: 0, goesNegative: false });
  }
  return rows;
}

function ScenarioCard({
  label,
  months,
  zeroDate,
  accent,
  sub,
}: {
  label: string;
  months: number;
  zeroDate: Date;
  accent: 'red' | 'amber' | 'emerald';
  sub?: string;
}) {
  const colourMap = {
    red:     { text: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/10' },
    amber:   { text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/10' },
    emerald: { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  };
  const c = colourMap[accent];
  return (
    <div className={`rounded-2xl border p-5 ${c.bg} ${c.border}`}>
      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
      <p className={`text-4xl font-black ${c.text} mb-1`}>{months > 0 ? months.toFixed(1) : '0'}</p>
      <p className="text-[10px] font-mono text-slate-500 mb-2">months runway</p>
      <p className={`text-xs font-mono font-bold ${c.text}`}>
        Zero: {fmtMonthYear(zeroDate)}
      </p>
      {sub && <p className="text-[10px] font-mono text-slate-500 mt-2 leading-relaxed">{sub}</p>}
    </div>
  );
}

function RunwayTab({
  config,
  onConfigUpdate,
  showToast,
}: {
  config: VentureConfig | null;
  onConfigUpdate: (c: VentureConfig) => void;
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const today = new Date('2026-07-31');

  const [burnInput,  setBurnInput]  = React.useState<string>(() => pencePounds(config?.monthly_burn_pence));
  const [cashInput,  setCashInput]  = React.useState<string>(() => pencePounds(config?.cash_in_bank_pence));
  const [saving, setSaving] = React.useState(false);

  // Derived pence values from inputs
  const burnPence = burnInput  ? Math.round(parseFloat(burnInput)  * 100) : 0;
  const cashPence = cashInput  ? Math.round(parseFloat(cashInput)  * 100) : 0;

  const hasData = burnPence > 0 && cashPence > 0;

  async function saveRunway() {
    if (saving) return;
    setSaving(true);
    const res = await apiPost({
      action: 'update_runway',
      monthly_burn_pence: burnPence || null,
      cash_in_bank_pence: cashPence || null,
    });
    setSaving(false);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    onConfigUpdate(res.data as VentureConfig);
    showToast('Runway updated', 'success');
  }

  function handleBlur() { saveRunway(); }
  function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') saveRunway(); }

  // ── Computed projections ──────────────────────────────────────────────────
  const runwayMonths = hasData ? cashPence / burnPence : 0;
  const zeroDate     = addMonths(today, runwayMonths);

  // Round close deadline: today + runway - 3 month buffer
  const closeDeadlineDate   = addMonths(today, Math.max(0, runwayMonths - 3));
  const hasTarget            = (config?.target_raise_pence ?? 0) > 0;

  // 12-month table
  const tableRows = hasData ? buildCashFlowTable(cashPence, burnPence, today) : [];

  // Scenarios
  const bearBurn    = burnPence * 1.2;
  const bearMonths  = cashPence > 0 && bearBurn > 0 ? cashPence / bearBurn : 0;
  const bearZero    = addMonths(today, bearMonths);

  const baseMonths  = runwayMonths;
  const baseZero    = zeroDate;

  const raisePence  = config?.target_raise_pence ?? 0;
  const bullCash    = cashPence + raisePence; // raise closes in 3 months, adds to bank
  const bullBurn    = burnPence * 0.8;
  const bullMonths  = bullCash > 0 && bullBurn > 0 ? bullCash / bullBurn : 0;
  const bullZero    = addMonths(today, bullMonths);

  // MRR offset
  const mrrPence = config?.committed_pence ?? 0; // using committed as a proxy; you could swap to an MRR field
  // We'll use a separate signal: if mrrPence is meaningful it's actually storing MRR, not commitments
  // So we rely on a distinct flag — skip display if it's obviously the committed column
  const showMrr = false; // Placeholder: no dedicated MRR field yet in VentureConfig

  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Inputs card (always shown) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Runway Inputs</h3>
          <p className="text-[11px] font-mono text-slate-500 mb-5">
            Update these when your bank balance or burn rate changes. All projections recalculate instantly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label>Monthly Burn (£/month)</Label>
              <input
                type="number"
                value={burnInput}
                onChange={e => setBurnInput(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 15000"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <Label>Cash in Bank (£)</Label>
              <input
                type="number"
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 180000"
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        </div>

        {/* Empty state prompt */}
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-700 rounded-2xl py-20 text-center">
          <p className="text-slate-500 font-mono text-sm mb-2">Enter your monthly burn and current cash balance to see runway projections</p>
          <p className="text-slate-700 font-mono text-xs">Projections recalculate instantly as you type</p>
        </div>
      </div>
    );
  }

  const runwayColourClass  = runwayColour(runwayMonths);
  const runwayBorderClass  = runwayBorderColour(runwayMonths);
  const runwayBgClass      = runwayBgColour(runwayMonths);
  const isPulsing          = runwayMonths < 3;

  return (
    <div className="space-y-6">
      {/* Inputs panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Runway Inputs</h3>
        <p className="text-[11px] font-mono text-slate-500 mb-5">
          Update these when your bank balance or burn rate changes. All projections recalculate instantly.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label>Monthly Burn (£/month)</Label>
            <input
              type="number"
              value={burnInput}
              onChange={e => setBurnInput(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 15000"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <Label>Cash in Bank (£)</Label>
            <input
              type="number"
              value={cashInput}
              onChange={e => setCashInput(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder="e.g. 180000"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
        {saving && (
          <p className="text-[10px] font-mono text-slate-500 mt-3">Saving...</p>
        )}
      </div>

      {/* Headline stat */}
      <div className={`rounded-2xl border p-8 text-center ${runwayBgClass} ${runwayBorderClass}`}>
        <p className={`text-7xl font-black ${runwayColourClass} ${isPulsing ? 'animate-pulse' : ''} mb-2`}>
          {runwayMonths.toFixed(1)}
        </p>
        <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">months runway</p>
        <p className="text-[11px] font-mono text-slate-400">
          at current burn rate &middot; until {fmtMonthYear(zeroDate)}
        </p>
      </div>

      {/* Round close deadline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-3">Round Close Deadline</h3>
        {hasTarget ? (
          <div className={`flex items-start gap-4 p-4 rounded-xl ${runwayBgClass} ${runwayBorderClass} border`}>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                To avoid a gap, the round must close by{' '}
                <span className={`${runwayColourClass} font-black`}>{fmtMonthYear(closeDeadlineDate)}</span>
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                3-month buffer for legal / closing deducted from current runway of {runwayMonths.toFixed(1)} months
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm font-mono text-slate-500">
            Set a fundraising target in the <span className="text-amber-400">Round</span> tab to see close deadline
          </p>
        )}
      </div>

      {/* Scenario cards */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-4">Scenarios</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScenarioCard
            label="Bear — burn +20%"
            months={bearMonths}
            zeroDate={bearZero}
            accent="red"
            sub={`Burn: ${pence(bearBurn)}/mo`}
          />
          <ScenarioCard
            label="Base — current"
            months={baseMonths}
            zeroDate={baseZero}
            accent={baseMonths > 6 ? 'emerald' : 'amber'}
            sub={`Burn: ${pence(burnPence)}/mo`}
          />
          <ScenarioCard
            label={raisePence > 0 ? `Bull — burn -20% + round closes` : 'Bull — burn -20%'}
            months={bullMonths}
            zeroDate={bullZero}
            accent="emerald"
            sub={raisePence > 0
              ? `Burn: ${pence(bullBurn)}/mo · +${pence(raisePence)} raised`
              : `Burn: ${pence(bullBurn)}/mo`}
          />
        </div>
      </div>

      {/* 12-month cash flow table */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-4">12-Month Cash Flow</h3>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Month</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Opening Balance</th>
                  <th className="text-right px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Burn</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Closing Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {tableRows.map((row, idx) => {
                  const exhausted = idx > 0 && tableRows[idx - 1].goesNegative;
                  const isNegative = row.goesNegative;
                  return (
                    <tr
                      key={row.month}
                      className={`${
                        isNegative
                          ? 'bg-red-950/30'
                          : exhausted
                          ? 'opacity-30'
                          : 'hover:bg-slate-800/40'
                      } transition-colors`}
                    >
                      <td className={`px-5 py-3 text-sm font-mono ${exhausted ? 'text-slate-700' : 'text-slate-600 dark:text-slate-300'}`}>
                        {row.label}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-mono ${exhausted ? 'text-slate-700' : 'text-slate-400'}`}>
                        {exhausted ? '—' : pence(row.opening)}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-mono ${exhausted ? 'text-slate-700' : 'text-red-400/70'}`}>
                        {exhausted ? '—' : `−${pence(row.burn)}`}
                      </td>
                      <td className={`px-5 py-3 text-right text-sm font-mono font-bold ${
                        isNegative ? 'text-red-400' : exhausted ? 'text-slate-700' : 'text-slate-900 dark:text-white'
                      }`}>
                        {isNegative ? 'ZERO' : exhausted ? '—' : pence(row.closing)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MRR offset — shown only if showMrr flag is set */}
      {showMrr && (
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 rounded-2xl p-5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 mb-1">MRR Offset</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            MRR offsets burn by <span className="text-emerald-400 font-bold">{pence(mrrPence)}/month</span>
            {' '}&rarr; effective burn = <span className="text-slate-900 dark:text-white font-bold">{pence(Math.max(0, burnPence - mrrPence))}/month</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function VentureClient({ initialData }: { initialData: VentureData }) {
  const [tab, setTab] = useState<Tab>('round');
  const [investors, setInvestors] = useState<Investor[]>(initialData.investors);
  const [config, setConfig] = useState<VentureConfig | null>(initialData.config);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  function showToast(message: string, kind: 'success' | 'error') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2500);
  }

  function handleAdd(inv: Investor) { setInvestors(prev => [inv, ...prev]); }
  function handleUpdate(inv: Investor) { setInvestors(prev => prev.map(i => i.id === inv.id ? inv : i)); }
  function handleDelete(id: string) { setInvestors(prev => prev.filter(i => i.id !== id)); }

  return (
    <div className="space-y-6">
      <TabBar active={tab} onChange={setTab} />

      {tab === 'round' && (
        <RoundTab config={config} onConfigUpdate={setConfig} showToast={showToast} />
      )}
      {tab === 'investors' && (
        <InvestorsTab
          investors={investors}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          showToast={showToast}
        />
      )}
      {tab === 'kpis' && (
        <KpiBoard kpis={initialData.kpis} investors={investors} config={config} />
      )}
      {tab === 'updates' && (
        <UpdatesTab investors={investors} />
      )}
      {tab === 'runway' && (
        <RunwayTab config={config} onConfigUpdate={setConfig} showToast={showToast} />
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
