'use client';

import React, { useState, useTransition, useMemo } from 'react';
import type { Grant } from '@/app/api/admin/grants/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(pence: number | null | undefined): string {
  if (pence == null) return '—';
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1)}M`;
  if (pounds >= 1_000)    return `£${Math.round(pounds / 1_000)}k`;
  return `£${pounds.toLocaleString('en-GB')}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/grants', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  return res.json() as Promise<{ grant?: Grant; grants?: Grant[]; ok?: boolean; error?: string }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLUMNS = [
  { id: 'researching',  label: 'Researching',     badge: 'bg-slate-700 text-slate-300' },
  { id: 'drafting',     label: 'Drafting',         badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  { id: 'submitted',    label: 'Submitted',        badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/30' },
  { id: 'under_review', label: 'Under Review',     badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  { id: 'awarded',      label: 'Awarded',          badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  { id: 'rejected',     label: 'Rejected / W/D',  badge: 'bg-red-900/30 text-red-500/70' },
] as const;

const GRANT_TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  innovate_uk: { label: 'Innovate UK',  badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/30' },
  sbri:        { label: 'SBRI',         badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
  nihr:        { label: 'NIHR i4i',     badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  wellcome:    { label: 'Wellcome',     badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
  horizon:     { label: 'EU Horizon',   badge: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30' },
  seis_eis:    { label: 'SEIS / EIS',   badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  private:     { label: 'Private',      badge: 'bg-slate-600/40 text-slate-300 border border-slate-600/40' },
  other:       { label: 'Other',        badge: 'bg-slate-700 text-slate-400' },
};

const GRANT_TYPE_OPTIONS = [
  { value: 'innovate_uk', label: 'Innovate UK' },
  { value: 'sbri',        label: 'SBRI Healthcare / Defence' },
  { value: 'nihr',        label: 'NIHR i4i' },
  { value: 'wellcome',    label: 'Wellcome Trust' },
  { value: 'horizon',     label: 'EU Horizon' },
  { value: 'seis_eis',    label: 'SEIS / EIS' },
  { value: 'private',     label: 'Private Foundation' },
  { value: 'other',       label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'researching',  label: 'Researching' },
  { value: 'drafting',     label: 'Drafting' },
  { value: 'submitted',    label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'awarded',      label: 'Awarded' },
  { value: 'rejected',     label: 'Rejected' },
  { value: 'withdrawn',    label: 'Withdrawn' },
];

const RECOMMENDED_GRANTS = [
  { name: 'SBRI Healthcare Phase 2',     funder: 'NHS England / SBRI Healthcare', grant_type: 'sbri',        note: 'Up to £1M development phase — follow SBRI Phase 1 success' },
  { name: 'Innovate UK Smart Grant',     funder: 'Innovate UK',                  grant_type: 'innovate_uk', note: 'Up to £500k for R&D projects; rolling competition' },
  { name: 'NIHR i4i Connect',            funder: 'NIHR',                         grant_type: 'nihr',        note: 'Up to £1M for medical software; NHS partner required' },
  { name: 'Wellcome Trust Discovery',    funder: 'Wellcome Trust',               grant_type: 'wellcome',    note: 'Up to £250k; health innovation focus' },
  { name: 'EU Horizon Health Cluster',   funder: 'European Commission',          grant_type: 'horizon',     note: 'UK eligible via Horizon Europe; digital health calls' },
  { name: 'DASA Themed Competition',     funder: 'DASA / MOD',                   grant_type: 'sbri',        note: 'Defence applications of speech AI; up to £300k Phase 1' },
];

// ── Form blank/init ───────────────────────────────────────────────────────────

type GrantForm = {
  name:             string;
  funder:           string;
  grant_type:       string;
  amount_pounds:    string;
  awarded_pounds:   string;
  status:           string;
  deadline:         string;
  submitted_at:     string;
  decision_date:    string;
  lead_contact:     string;
  reference_number: string;
  notes:            string;
};

function blankForm(prefill?: Partial<GrantForm>): GrantForm {
  return {
    name:             '',
    funder:           '',
    grant_type:       'innovate_uk',
    amount_pounds:    '',
    awarded_pounds:   '',
    status:           'researching',
    deadline:         '',
    submitted_at:     '',
    decision_date:    '',
    lead_contact:     '',
    reference_number: '',
    notes:            '',
    ...prefill,
  };
}

function grantToForm(g: Grant): GrantForm {
  return {
    name:             g.name,
    funder:           g.funder,
    grant_type:       g.grant_type,
    amount_pounds:    g.amount_pence  != null ? String(Math.round(g.amount_pence  / 100)) : '',
    awarded_pounds:   g.awarded_pence != null ? String(Math.round(g.awarded_pence / 100)) : '',
    status:           g.status,
    deadline:         g.deadline      ?? '',
    submitted_at:     g.submitted_at  ?? '',
    decision_date:    g.decision_date ?? '',
    lead_contact:     g.lead_contact  ?? '',
    reference_number: g.reference_number ?? '',
    notes:            g.notes         ?? '',
  };
}

function formToPayload(f: GrantForm): Record<string, unknown> {
  return {
    name:             f.name,
    funder:           f.funder,
    grant_type:       f.grant_type,
    amount_pence:     f.amount_pounds  ? Math.round(parseFloat(f.amount_pounds)  * 100) : null,
    awarded_pence:    f.awarded_pounds ? Math.round(parseFloat(f.awarded_pounds) * 100) : null,
    status:           f.status,
    deadline:         f.deadline        || null,
    submitted_at:     f.submitted_at    || null,
    decision_date:    f.decision_date   || null,
    lead_contact:     f.lead_contact    || null,
    reference_number: f.reference_number || null,
    notes:            f.notes           || null,
  };
}

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

// ── Form helpers ──────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = 'text',
}: {
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
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
    />
  );
}

function Textarea({
  value, onChange, placeholder, rows = 2,
}: {
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
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
    />
  );
}

function SelectInput({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Deadline chip ──────────────────────────────────────────────────────────────

function DeadlineChip({ deadline }: { deadline: string | null | undefined }) {
  if (!deadline) return <span className="text-[10px] font-mono text-slate-600">No deadline</span>;
  const days = daysUntil(deadline);
  const cls =
    days < 0   ? 'bg-red-900/30 text-red-400 border border-red-800/40' :
    days <= 30  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                  'bg-slate-800 text-slate-400 border border-slate-700';
  const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${cls}`}>
      {label}
    </span>
  );
}

// ── Grant type badge ───────────────────────────────────────────────────────────

function TypeBadge({ grantType }: { grantType: string }) {
  const cfg = GRANT_TYPE_CONFIG[grantType] ?? GRANT_TYPE_CONFIG.other;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const col = STATUS_COLUMNS.find(c => c.id === status || (c.id === 'rejected' && status === 'withdrawn'));
  const badge = col?.badge ?? 'bg-slate-700 text-slate-300';
  const label = STATUS_OPTIONS.find(o => o.value === status)?.label ?? status;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${badge}`}>
      {label}
    </span>
  );
}

// ── Slide-in panel ────────────────────────────────────────────────────────────

function SlidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="14" y2="14" />
              <line x1="14" y1="4" x2="4" y2="14" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </aside>
    </>
  );
}

// ── Grant form ────────────────────────────────────────────────────────────────

function GrantFormContent({
  initial,
  onSave,
  onCancel,
  isPending,
  isEdit,
}: {
  initial: GrantForm;
  onSave: (f: GrantForm) => void;
  onCancel: () => void;
  isPending: boolean;
  isEdit: boolean;
}) {
  const [form, setForm] = useState<GrantForm>(initial);
  function field<K extends keyof GrantForm>(k: K, v: GrantForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Grant Name *</Label>
          <Input value={form.name} onChange={v => field('name', v)} placeholder="e.g. Innovate UK Smart Grant" />
        </div>
        <div className="sm:col-span-2">
          <Label>Funder *</Label>
          <Input value={form.funder} onChange={v => field('funder', v)} placeholder="e.g. Innovate UK" />
        </div>
        <div>
          <Label>Grant Type</Label>
          <SelectInput value={form.grant_type} onChange={v => field('grant_type', v)} options={GRANT_TYPE_OPTIONS} />
        </div>
        <div>
          <Label>Status</Label>
          <SelectInput value={form.status} onChange={v => field('status', v)} options={STATUS_OPTIONS} />
        </div>
        <div>
          <Label>Max Amount (£)</Label>
          <Input value={form.amount_pounds} onChange={v => field('amount_pounds', v)} placeholder="e.g. 500000" type="number" />
        </div>
        <div>
          <Label>Awarded Amount (£)</Label>
          <Input value={form.awarded_pounds} onChange={v => field('awarded_pounds', v)} placeholder="if awarded" type="number" />
        </div>
        <div>
          <Label>Deadline</Label>
          <Input value={form.deadline} onChange={v => field('deadline', v)} type="date" />
        </div>
        <div>
          <Label>Submitted Date</Label>
          <Input value={form.submitted_at} onChange={v => field('submitted_at', v)} type="date" />
        </div>
        <div>
          <Label>Decision Date</Label>
          <Input value={form.decision_date} onChange={v => field('decision_date', v)} type="date" />
        </div>
        <div>
          <Label>Lead Contact</Label>
          <Input value={form.lead_contact} onChange={v => field('lead_contact', v)} placeholder="Name / email" />
        </div>
        <div className="sm:col-span-2">
          <Label>Reference Number</Label>
          <Input value={form.reference_number} onChange={v => field('reference_number', v)} placeholder="Application ref" />
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={v => field('notes', v)} placeholder="Application notes, requirements, contacts..." rows={4} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending || !form.name || !form.funder}
          className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
        >
          {isPending ? 'Saving…' : isEdit ? 'Update Grant' : 'Add Grant'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = 'white',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'white' | 'emerald' | 'amber' | 'sky';
}) {
  const colorMap = { white: 'text-white', emerald: 'text-emerald-400', amber: 'text-amber-400', sky: 'text-sky-400' };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-black ${colorMap[accent]}`}>{value}</p>
      {sub && <p className="text-[11px] font-mono text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

// ── Kanban card ────────────────────────────────────────────────────────────────

function KanbanCard({
  grant,
  onEdit,
}: {
  grant: Grant;
  onEdit: (g: Grant) => void;
}) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 group hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-white leading-snug flex-1">{grant.name}</p>
        <button
          type="button"
          onClick={() => onEdit(grant)}
          className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] font-mono rounded border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-all flex-shrink-0"
        >
          Edit
        </button>
      </div>
      <p className="text-[10px] font-mono text-slate-500 truncate">{grant.funder}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {grant.amount_pence != null && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
            {formatAmount(grant.amount_pence)}
          </span>
        )}
        <TypeBadge grantType={grant.grant_type} />
      </div>
      {grant.deadline && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-600">{fmtDate(grant.deadline)}</span>
          <DeadlineChip deadline={grant.deadline} />
        </div>
      )}
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(grants: Grant[]) {
  const headers = [
    'Name', 'Funder', 'Type', 'Max Amount (£)', 'Awarded (£)',
    'Status', 'Deadline', 'Submitted', 'Decision Date',
    'Lead Contact', 'Reference', 'Notes',
  ];
  const rows = grants.map(g => [
    g.name,
    g.funder,
    GRANT_TYPE_CONFIG[g.grant_type]?.label ?? g.grant_type,
    g.amount_pence  != null ? String(Math.round(g.amount_pence  / 100)) : '',
    g.awarded_pence != null ? String(Math.round(g.awarded_pence / 100)) : '',
    STATUS_OPTIONS.find(o => o.value === g.status)?.label ?? g.status,
    g.deadline      ?? '',
    g.submitted_at  ?? '',
    g.decision_date ?? '',
    g.lead_contact  ?? '',
    g.reference_number ?? '',
    (g.notes ?? '').replace(/"/g, '""'),
  ].map(v => `"${v}"`).join(','));

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `flowen-grants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main client ───────────────────────────────────────────────────────────────

type PanelState =
  | { mode: 'closed' }
  | { mode: 'add'; prefill?: Partial<GrantForm> }
  | { mode: 'edit'; grant: Grant };

type ViewMode = 'kanban' | 'table';

export function GrantsClient({ initialGrants }: { initialGrants: Grant[] }) {
  const [grants, setGrants]       = useState<Grant[]>(initialGrants);
  const [panel, setPanel]         = useState<PanelState>({ mode: 'closed' });
  const [viewMode, setViewMode]   = useState<ViewMode>('kanban');
  const [isPending, startTrans]   = useTransition();
  const [toast, setToast]         = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  function showToast(message: string, kind: 'success' | 'error') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2500);
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = grants.filter(g => g.status !== 'rejected' && g.status !== 'withdrawn');
    const totalPipeline = active.reduce((s, g) => s + (g.amount_pence ?? 0), 0);

    const awardedGrants = grants.filter(g => g.status === 'awarded');
    const totalAwarded  = awardedGrants.reduce((s, g) => s + (g.awarded_pence ?? g.amount_pence ?? 0), 0);

    const underReview = grants.filter(g => g.status === 'submitted' || g.status === 'under_review').length;

    const completedCount = awardedGrants.length + grants.filter(g => g.status === 'rejected').length;
    const successRate = completedCount > 0
      ? `${Math.round((awardedGrants.length / completedCount) * 100)}%`
      : '—';

    return { totalPipeline, totalAwarded, underReview, successRate };
  }, [grants]);

  // ── Deadline alerts ──────────────────────────────────────────────────────────

  const deadlineAlerts = useMemo(() => {
    return grants.filter(g => {
      if (!g.deadline) return false;
      if (g.status !== 'researching' && g.status !== 'drafting') return false;
      const days = daysUntil(g.deadline);
      return days >= 0 && days <= 30;
    }).map(g => ({ grant: g, days: daysUntil(g.deadline!) }));
  }, [grants]);

  // ── CRUD handlers ────────────────────────────────────────────────────────────

  function handleAdd(form: GrantForm) {
    startTrans(async () => {
      const res = await apiPost({ action: 'add', ...formToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setGrants(prev => [res.grant!, ...prev]);
      setPanel({ mode: 'closed' });
      showToast('Grant added', 'success');
    });
  }

  function handleUpdate(id: string, form: GrantForm) {
    startTrans(async () => {
      const res = await apiPost({ action: 'update', id, ...formToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setGrants(prev => prev.map(g => g.id === id ? res.grant! : g));
      setPanel({ mode: 'closed' });
      showToast('Grant updated', 'success');
    });
  }

  function handleDelete(id: string) {
    startTrans(async () => {
      const res = await apiPost({ action: 'delete', id });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setGrants(prev => prev.filter(g => g.id !== id));
      setPanel({ mode: 'closed' });
      showToast('Grant deleted', 'success');
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isEmpty = grants.length === 0;

  return (
    <div className="space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 tracking-widest">
            NON-DILUTIVE PIPELINE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCsv(grants)}
            className="px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
          >
            CSV Export
          </button>
          <button
            type="button"
            onClick={() => setPanel({ mode: 'add' })}
            className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            + Add Grant
          </button>
        </div>
      </div>

      {/* Pipeline summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Pipeline"
          value={formatAmount(stats.totalPipeline)}
          sub="Non-rejected / withdrawn"
          accent="white"
        />
        <StatCard
          label="Awarded"
          value={formatAmount(stats.totalAwarded)}
          sub={`${grants.filter(g => g.status === 'awarded').length} grant(s) awarded`}
          accent="emerald"
        />
        <StatCard
          label="Under Review"
          value={String(stats.underReview)}
          sub="Submitted or under review"
          accent="amber"
        />
        <StatCard
          label="Success Rate"
          value={stats.successRate}
          sub="Awarded vs rejected"
          accent="sky"
        />
      </div>

      {/* Deadline alert banner */}
      {deadlineAlerts.length > 0 && (
        <div className="bg-amber-500/8 border border-amber-500/30 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-xs font-bold text-amber-400 mb-2">Deadline Alert — Action Required</p>
              <ul className="space-y-1">
                {deadlineAlerts.map(({ grant, days }) => (
                  <li key={grant.id} className="text-[11px] font-mono text-amber-300/80">
                    <span className="font-bold">{grant.name}</span>
                    {' '}({grant.funder}) — deadline {fmtDate(grant.deadline)}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">
                      {days === 0 ? 'today' : `${days}d remaining`}
                    </span>
                    <span className="ml-1.5 text-amber-500/60">
                      ({STATUS_OPTIONS.find(o => o.value === grant.status)?.label ?? grant.status})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* View toggle */}
      {!isEmpty && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {(['kanban', 'table'] as ViewMode[]).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                className={`px-4 py-1.5 text-xs font-mono rounded-lg transition-colors capitalize ${
                  viewMode === v
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {v === 'kanban' ? 'Kanban' : 'Table'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h3 className="text-sm font-bold text-white mb-1">No grants tracked yet</h3>
          <p className="text-xs text-slate-500 font-mono mb-6">Start by adding one of these recommended grant programmes:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {RECOMMENDED_GRANTS.map(rec => (
              <button
                key={rec.name}
                type="button"
                onClick={() => setPanel({
                  mode: 'add',
                  prefill: { name: rec.name, funder: rec.funder, grant_type: rec.grant_type },
                })}
                className="text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl p-4 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">{rec.name}</p>
                  <TypeBadge grantType={rec.grant_type} />
                </div>
                <p className="text-[10px] font-mono text-slate-500 mb-1">{rec.funder}</p>
                <p className="text-[10px] text-slate-600 leading-relaxed">{rec.note}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kanban view */}
      {!isEmpty && viewMode === 'kanban' && (
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 min-w-[900px]">
            {STATUS_COLUMNS.map(col => {
              const colGrants = grants.filter(g =>
                col.id === 'rejected'
                  ? g.status === 'rejected' || g.status === 'withdrawn'
                  : g.status === col.id,
              );
              return (
                <div key={col.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${col.badge}`}>
                      {col.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-700">{colGrants.length}</span>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {colGrants.map(g => (
                      <KanbanCard key={g.id} grant={g} onEdit={g => setPanel({ mode: 'edit', grant: g })} />
                    ))}
                    {colGrants.length === 0 && (
                      <div className="border border-dashed border-slate-800 rounded-xl h-16 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-slate-800">empty</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table view */}
      {!isEmpty && viewMode === 'table' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Name', 'Funder', 'Type', 'Amount', 'Status', 'Deadline', 'Submitted', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {grants.map(g => (
                  <tr key={g.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-white whitespace-nowrap">{g.name}</p>
                      {g.reference_number && (
                        <p className="text-[10px] font-mono text-slate-600">{g.reference_number}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[11px] font-mono text-slate-400 max-w-[140px] truncate">{g.funder}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <TypeBadge grantType={g.grant_type} />
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-mono font-bold text-amber-400 whitespace-nowrap">{formatAmount(g.amount_pence)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-500">{fmtDate(g.deadline)}</span>
                        {g.deadline && <DeadlineChip deadline={g.deadline} />}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-[11px] font-mono text-slate-500 whitespace-nowrap">{fmtDate(g.submitted_at)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setPanel({ mode: 'edit', grant: g })}
                          className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(g.id)}
                          disabled={isPending}
                          className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-in panel: Add */}
      {panel.mode === 'add' && (
        <SlidePanel title="Add Grant" onClose={() => setPanel({ mode: 'closed' })}>
          <GrantFormContent
            initial={blankForm(panel.prefill)}
            onSave={handleAdd}
            onCancel={() => setPanel({ mode: 'closed' })}
            isPending={isPending}
            isEdit={false}
          />
        </SlidePanel>
      )}

      {/* Slide-in panel: Edit */}
      {panel.mode === 'edit' && (
        <SlidePanel title="Edit Grant" onClose={() => setPanel({ mode: 'closed' })}>
          <GrantFormContent
            initial={grantToForm(panel.grant)}
            onSave={f => handleUpdate(panel.grant.id, f)}
            onCancel={() => setPanel({ mode: 'closed' })}
            isPending={isPending}
            isEdit={true}
          />
          <div className="mt-8 pt-5 border-t border-slate-800">
            <button
              type="button"
              onClick={() => handleDelete(panel.grant.id)}
              disabled={isPending}
              className="px-4 py-2 text-xs font-mono text-red-500 hover:text-red-400 border border-red-900/40 hover:border-red-800/60 rounded-xl transition-colors disabled:opacity-40"
            >
              Delete this grant
            </button>
          </div>
        </SlidePanel>
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
