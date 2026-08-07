'use client';

import React, { useState, useTransition } from 'react';
import type { AuditItem, AuditCategory, AuditStatus, RiskLevel, FundingItem, FundingType, FundingStatus } from '@/app/api/admin/ip-readiness/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(pence: number | null): string {
  if (pence == null) return '—';
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(1)}m`;
  if (p >= 1_000) return `£${(p / 1_000).toFixed(0)}k`;
  return `£${p.toLocaleString('en-GB')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/ip-readiness', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ item?: unknown; auditItems?: AuditItem[]; fundingItems?: FundingItem[]; ok?: boolean; error?: string }>;
}

// ── Config ────────────────────────────────────────────────────────────────────

const AUDIT_CATEGORIES: { id: AuditCategory; label: string; icon: string }[] = [
  { id: 'patents',       label: 'Patents',        icon: '⚡' },
  { id: 'trademarks',   label: 'Trademarks',     icon: '™' },
  { id: 'ai_models',    label: 'AI Models',      icon: '🧠' },
  { id: 'data_datasets',label: 'Data & Datasets', icon: '📊' },
  { id: 'software',     label: 'Software',       icon: '💻' },
  { id: 'trade_secrets',label: 'Trade Secrets',  icon: '🔒' },
  { id: 'contracts',    label: 'Contracts',      icon: '📋' },
];

const AUDIT_STATUSES: { id: AuditStatus; label: string; cls: string }[] = [
  { id: 'not_started', label: 'Not Started', cls: 'bg-slate-700/50 text-slate-400 border border-slate-700' },
  { id: 'in_progress', label: 'In Progress', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  { id: 'complete',    label: 'Complete',    cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  { id: 'blocked',     label: 'Blocked',     cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  { id: 'waived',      label: 'Waived',      cls: 'bg-slate-800 text-slate-600 border border-slate-800' },
];

const RISK_LEVELS: { id: RiskLevel; label: string; cls: string; dot: string }[] = [
  { id: 'critical', label: 'Critical', cls: 'text-red-400',    dot: 'bg-red-500' },
  { id: 'high',     label: 'High',     cls: 'text-orange-400', dot: 'bg-orange-400' },
  { id: 'medium',   label: 'Medium',   cls: 'text-amber-400',  dot: 'bg-amber-400' },
  { id: 'low',      label: 'Low',      cls: 'text-emerald-400',dot: 'bg-emerald-400' },
  { id: 'none',     label: 'None',     cls: 'text-slate-500',  dot: 'bg-slate-600' },
];

const FUNDING_TYPES: { id: FundingType; label: string; icon: string; badge: string }[] = [
  { id: 'grant',       label: 'Grants',        icon: '🏛️', badge: 'bg-sky-500/15 text-sky-300 border border-sky-500/30' },
  { id: 'tax_relief',  label: 'Tax Relief',    icon: '💰', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
  { id: 'loan',        label: 'Loans',         icon: '🏦', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  { id: 'legal_aid',   label: 'Legal Aid',     icon: '⚖️', badge: 'bg-purple-500/15 text-purple-300 border border-purple-500/30' },
  { id: 'licensing',   label: 'Licensing',     icon: '📜', badge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' },
  { id: 'partnership', label: 'Partnerships',  icon: '🤝', badge: 'bg-teal-500/15 text-teal-300 border border-teal-500/30' },
  { id: 'equity',      label: 'Equity',        icon: '📈', badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/30' },
];

const FUNDING_STATUSES: { id: FundingStatus; label: string; cls: string }[] = [
  { id: 'researching',   label: 'Researching',    cls: 'bg-slate-700/50 text-slate-400 border border-slate-700' },
  { id: 'eligible',      label: 'Eligible',       cls: 'bg-sky-500/15 text-sky-400 border border-sky-500/30' },
  { id: 'applied',       label: 'Applied',        cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  { id: 'in_progress',   label: 'In Progress',    cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  { id: 'awarded',       label: 'Awarded',        cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  { id: 'rejected',      label: 'Rejected',       cls: 'bg-red-500/15 text-red-400 border border-red-500/30' },
  { id: 'not_eligible',  label: 'Not Eligible',   cls: 'bg-slate-800 text-slate-600 border border-slate-800' },
  { id: 'on_hold',       label: 'On Hold',        cls: 'bg-slate-800 text-slate-500 border border-slate-700' },
];

const AUDIT_STATUS_MAP   = Object.fromEntries(AUDIT_STATUSES.map(s => [s.id, s]));
const RISK_MAP           = Object.fromEntries(RISK_LEVELS.map(r => [r.id, r]));
const FUNDING_TYPE_MAP   = Object.fromEntries(FUNDING_TYPES.map(t => [t.id, t]));
const FUNDING_STATUS_MAP = Object.fromEntries(FUNDING_STATUSES.map(s => [s.id, s]));

// ── Shared UI atoms ───────────────────────────────────────────────────────────

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60';
const labelCls = 'block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className={labelCls}>{children}</label>;
}

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

// ── IP Debt Score ─────────────────────────────────────────────────────────────

function computeDebtScore(items: AuditItem[]): number {
  if (items.length === 0) return 0;
  // Weight by risk level
  const riskWeight: Record<RiskLevel, number> = { critical: 5, high: 3, medium: 2, low: 1, none: 0 };
  const statusScore: Record<AuditStatus, number> = { complete: 1, waived: 0.8, in_progress: 0.4, blocked: 0.1, not_started: 0 };
  let totalWeight = 0;
  let earned = 0;
  for (const item of items) {
    const w = riskWeight[item.risk_level] ?? 1;
    totalWeight += w;
    earned += w * (statusScore[item.status] ?? 0);
  }
  return totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;
}

function DebtScoreGauge({ score }: { score: number }) {
  const colour = score >= 80 ? 'emerald' : score >= 50 ? 'amber' : score >= 25 ? 'orange' : 'red';
  const colourMap = {
    emerald: { ring: 'text-emerald-400', label: 'Low Risk', sub: 'IP portfolio well-protected' },
    amber:   { ring: 'text-amber-400',   label: 'Moderate',  sub: 'Some gaps need attention' },
    orange:  { ring: 'text-orange-400',  label: 'Elevated',  sub: 'Significant gaps remain' },
    red:     { ring: 'text-red-400',     label: 'High Risk', sub: 'Critical IP debt — investor blocker' },
  };
  const c = colourMap[colour];
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className={`${c.ring} transition-all duration-700`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-black ${c.ring}`}>{score}</span>
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">/ 100</span>
        </div>
      </div>
      <div>
        <p className={`text-xl font-black ${c.ring}`}>{c.label}</p>
        <p className="text-sm text-slate-400 mt-0.5">{c.sub}</p>
        <p className="text-[11px] font-mono text-slate-600 mt-2">IP Readiness Score — risk-weighted by audit item priority and risk level</p>
      </div>
    </div>
  );
}

// ── Readiness Summary ─────────────────────────────────────────────────────────

function ReadinessSummary({ auditItems, fundingItems }: { auditItems: AuditItem[]; fundingItems: FundingItem[] }) {
  const score = computeDebtScore(auditItems);

  const criticalBlockers  = auditItems.filter(i => i.risk_level === 'critical' && i.status !== 'complete' && i.status !== 'waived');
  const complete          = auditItems.filter(i => i.status === 'complete' || i.status === 'waived').length;
  const fundingActive     = fundingItems.filter(i => ['eligible', 'applied', 'in_progress', 'awarded'].includes(i.status)).length;
  const fundingAwarded    = fundingItems.filter(i => i.status === 'awarded');
  const awardedTotal      = fundingAwarded.reduce((s, i) => s + (i.max_amount_pence ?? 0), 0);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 border border-indigo-500/20 rounded-2xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">IP VENTURE READINESS</span>
          </div>
          <h2 className="text-lg font-black text-white">IP Debt & Venture Readiness</h2>
          <p className="text-xs text-slate-500 mt-0.5">Tier 1 audit progress · Tier 2 funding pipeline · Investor-ready IP score</p>
        </div>
      </div>

      <DebtScoreGauge score={score} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/60 rounded-xl p-3.5">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Audit Progress</p>
          <p className="text-2xl font-black text-white">{complete}<span className="text-base text-slate-500">/{auditItems.length}</span></p>
          <p className="text-[10px] font-mono text-slate-600 mt-0.5">items complete / waived</p>
        </div>
        <div className={`rounded-xl p-3.5 ${criticalBlockers.length > 0 ? 'bg-red-950/40 border border-red-500/20' : 'bg-slate-950/60'}`}>
          <p className={`text-[9px] font-mono uppercase tracking-widest mb-1 ${criticalBlockers.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>Critical Blockers</p>
          <p className={`text-2xl font-black ${criticalBlockers.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{criticalBlockers.length}</p>
          <p className="text-[10px] font-mono text-slate-600 mt-0.5">{criticalBlockers.length > 0 ? 'investor-blocking items' : 'no critical gaps'}</p>
        </div>
        <div className="bg-slate-950/60 rounded-xl p-3.5">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Funding Active</p>
          <p className="text-2xl font-black text-sky-400">{fundingActive}</p>
          <p className="text-[10px] font-mono text-slate-600 mt-0.5">programmes in flight</p>
        </div>
        <div className="bg-slate-950/60 rounded-xl p-3.5">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">IP Funding Value</p>
          <p className="text-2xl font-black text-emerald-400">{awardedTotal > 0 ? fmtGBP(awardedTotal) : '—'}</p>
          <p className="text-[10px] font-mono text-slate-600 mt-0.5">{fundingAwarded.length} programme{fundingAwarded.length !== 1 ? 's' : ''} awarded</p>
        </div>
      </div>

      {criticalBlockers.length > 0 && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl px-4 py-3">
          <p className="text-[10px] font-mono font-bold text-red-300 uppercase tracking-wide mb-1.5">Critical investor blockers — resolve before term sheet</p>
          <ul className="space-y-0.5">
            {criticalBlockers.map(b => (
              <li key={b.id} className="text-xs text-red-400/80 font-mono flex items-center gap-2">
                <span className="text-red-600">▸</span> {b.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type MainTab = 'tier1' | 'tier2';

function TabBar({ active, onChange }: { active: MainTab; onChange: (t: MainTab) => void }) {
  return (
    <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
      {([
        { id: 'tier1' as const, label: 'Tier 1 — IP Audit' },
        { id: 'tier2' as const, label: 'Tier 2 — IP Funding & Access' },
      ] as const).map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-5 py-2 text-sm font-mono rounded-lg transition-colors whitespace-nowrap ${
            active === t.id
              ? 'bg-indigo-600 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TIER 1 — IP AUDIT
// ──────────────────────────────────────────────────────────────────────────────

interface AuditFormValues {
  category:     AuditCategory;
  title:        string;
  description:  string;
  status:       AuditStatus;
  risk_level:   RiskLevel;
  priority:     string;
  assignee:     string;
  due_date:     string;
  evidence_url: string;
  notes:        string;
}

const BLANK_AUDIT: AuditFormValues = {
  category:     'contracts',
  title:        '',
  description:  '',
  status:       'not_started',
  risk_level:   'medium',
  priority:     '3',
  assignee:     '',
  due_date:     '',
  evidence_url: '',
  notes:        '',
};

function auditToForm(a: AuditItem): AuditFormValues {
  return {
    category:     a.category,
    title:        a.title,
    description:  a.description   ?? '',
    status:       a.status,
    risk_level:   a.risk_level,
    priority:     String(a.priority),
    assignee:     a.assignee      ?? '',
    due_date:     a.due_date      ?? '',
    evidence_url: a.evidence_url  ?? '',
    notes:        a.notes         ?? '',
  };
}

function AuditForm({ initial, onSave, onCancel, saving }: {
  initial: AuditFormValues;
  onSave: (f: AuditFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<AuditFormValues>(initial);
  function field<K extends keyof AuditFormValues>(k: K, v: AuditFormValues[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Category *</FieldLabel>
          <select value={form.category} onChange={e => field('category', e.target.value as AuditCategory)} className={inputCls}>
            {AUDIT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Risk Level</FieldLabel>
          <select value={form.risk_level} onChange={e => field('risk_level', e.target.value as RiskLevel)} className={inputCls}>
            {RISK_LEVELS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <FieldLabel>Title *</FieldLabel>
        <input value={form.title} onChange={e => field('title', e.target.value)} placeholder="e.g. Founder IP Assignment Deed" className={inputCls} />
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <input value={form.description} onChange={e => field('description', e.target.value)} placeholder="What needs to be done..." className={inputCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <FieldLabel>Status</FieldLabel>
          <select value={form.status} onChange={e => field('status', e.target.value as AuditStatus)} className={inputCls}>
            {AUDIT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Priority (1 = highest)</FieldLabel>
          <input type="number" min="1" max="9" value={form.priority} onChange={e => field('priority', e.target.value)} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Due Date</FieldLabel>
          <input type="date" value={form.due_date} onChange={e => field('due_date', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Assignee</FieldLabel>
          <input value={form.assignee} onChange={e => field('assignee', e.target.value)} placeholder="Name or team" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Evidence URL</FieldLabel>
          <input value={form.evidence_url} onChange={e => field('evidence_url', e.target.value)} placeholder="https://..." className={inputCls} />
        </div>
      </div>
      <div>
        <FieldLabel>Notes</FieldLabel>
        <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2} placeholder="Internal notes, context, blockers..." className={`${inputCls} resize-none`} />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => onSave(form)} disabled={saving || !form.title}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save Item'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function RiskDot({ level }: { level: RiskLevel }) {
  const r = RISK_MAP[level] ?? RISK_MAP.medium;
  return <span className={`inline-block w-2 h-2 rounded-full ${r.dot} shrink-0 mt-0.5`} />;
}

function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const s = AUDIT_STATUS_MAP[status] ?? AUDIT_STATUS_MAP.not_started;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${s.cls}`}>{s.label}</span>;
}

function AuditItemRow({ item, onEdit, onDelete, onStatusChange, deleting }: {
  item: AuditItem;
  onEdit: (a: AuditItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: AuditStatus) => void;
  deleting: boolean;
}) {
  const risk = RISK_MAP[item.risk_level] ?? RISK_MAP.medium;

  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 hover:bg-slate-800/30 rounded-xl transition-colors">
      <RiskDot level={item.risk_level} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-white leading-tight">{item.title}</p>
          <AuditStatusBadge status={item.status} />
          <span className={`text-[9px] font-mono font-bold ${risk.cls}`}>
            {risk.label.toUpperCase()} RISK
          </span>
        </div>
        {item.description && <p className="text-xs text-slate-500 mb-1.5">{item.description}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono text-slate-600">
          {item.assignee && <span>Assignee: <span className="text-slate-400">{item.assignee}</span></span>}
          {item.due_date && <span>Due: <span className="text-slate-400">{fmtDate(item.due_date)}</span></span>}
          {item.evidence_url && (
            <a href={item.evidence_url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-400 transition-colors">
              Evidence ↗
            </a>
          )}
          {item.notes && <span className="text-slate-700 italic truncate max-w-[300px]">{item.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Quick status cycle */}
        <select
          value={item.status}
          onChange={e => onStatusChange(item.id, e.target.value as AuditStatus)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-indigo-500/60"
          onClick={e => e.stopPropagation()}
        >
          {AUDIT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" onClick={() => onEdit(item)}
          className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
          Edit
        </button>
        <button type="button" onClick={() => onDelete(item.id)} disabled={deleting}
          className="px-2 py-1 text-[10px] font-mono rounded-lg border border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40">
          ×
        </button>
      </div>
    </div>
  );
}

function AuditCategorySection({ cat, items, onEdit, onDelete, onStatusChange, deletingId }: {
  cat: typeof AUDIT_CATEGORIES[number];
  items: AuditItem[];
  onEdit: (a: AuditItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: AuditStatus) => void;
  deletingId: string | null;
}) {
  const [open, setOpen] = useState(true);
  const complete = items.filter(i => i.status === 'complete' || i.status === 'waived').length;
  const hasCritical = items.some(i => i.risk_level === 'critical' && i.status !== 'complete' && i.status !== 'waived');

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors ${hasCritical ? 'border-red-800/40 bg-red-950/10' : 'border-slate-800 bg-slate-900'}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-lg">{cat.icon}</span>
          <span className="text-sm font-bold text-white">{cat.label}</span>
          {hasCritical && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">CRITICAL</span>
          )}
          <span className="text-xs font-mono text-slate-500">{complete}/{items.length} done</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini progress */}
          <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
            <div
              className={`h-full rounded-full transition-all ${hasCritical ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: items.length > 0 ? `${(complete / items.length) * 100}%` : '0%' }}
            />
          </div>
          <svg className={`w-4 h-4 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-slate-800/60 border-t border-slate-800/60">
          {items.map(item => (
            <AuditItemRow
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              deleting={deletingId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tier1AuditTab({ items: initial, showToast }: {
  items: AuditItem[];
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const [items, setItems] = useState<AuditItem[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<AuditItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<AuditCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AuditStatus | 'all'>('all');

  const filtered = items.filter(i =>
    (filterCat === 'all' || i.category === filterCat) &&
    (filterStatus === 'all' || i.status === filterStatus)
  );

  // Group by category
  const grouped = AUDIT_CATEGORIES.map(cat => ({
    cat,
    items: filtered.filter(i => i.category === cat.id),
  })).filter(g => g.items.length > 0);

  async function handleAdd(form: AuditFormValues) {
    setSaving(true);
    const res = await apiPost({ action: 'audit_add', ...form, priority: Number(form.priority) || 3 });
    setSaving(false);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setItems(prev => [...prev, res.item as AuditItem].sort((a, b) => a.priority - b.priority));
    setShowAdd(false);
    showToast('Audit item added', 'success');
  }

  async function handleEdit(form: AuditFormValues) {
    if (!editing) return;
    setSaving(true);
    const res = await apiPost({ action: 'audit_update', id: editing.id, ...form, priority: Number(form.priority) || 3 });
    setSaving(false);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setItems(prev => prev.map(i => i.id === editing.id ? res.item as AuditItem : i));
    setEditing(null);
    showToast('Audit item updated', 'success');
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await apiPost({ action: 'audit_delete', id });
    setDeletingId(null);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
    showToast('Item removed', 'success');
  }

  async function handleStatusChange(id: string, status: AuditStatus) {
    const res = await apiPost({ action: 'audit_status', id, status });
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setItems(prev => prev.map(i => i.id === id ? res.item as AuditItem : i));
  }

  const score = computeDebtScore(items);
  const complete = items.filter(i => i.status === 'complete' || i.status === 'waived').length;

  return (
    <div className="space-y-5">
      {/* Audit score strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {AUDIT_STATUSES.map(s => {
          const count = items.filter(i => i.status === s.id).length;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilterStatus(f => f === s.id ? 'all' : s.id)}
              className={`bg-slate-900 border rounded-xl p-3.5 text-left transition-all ${
                filterStatus === s.id ? 'border-indigo-500/50' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${count > 0 ? 'text-white' : 'text-slate-700'}`}>{count}</p>
            </button>
          );
        })}
      </div>

      {/* Score + progress bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-black ${score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {score}%
          </div>
          <div>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">IP Readiness</p>
            <p className="text-[10px] font-mono text-slate-600">{complete}/{items.length} items resolved</p>
          </div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters + add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilterCat('all')}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${filterCat === 'all' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            All ({items.length})
          </button>
          {AUDIT_CATEGORIES.map(c => {
            const count = items.filter(i => i.category === c.id).length;
            if (count === 0) return null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilterCat(f => f === c.id ? 'all' : c.id)}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${filterCat === c.id ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {c.icon} {c.label} ({count})
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(v => !v); setEditing(null); }}
          className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {/* Add / edit form */}
      {showAdd && (
        <AuditForm initial={BLANK_AUDIT} onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
      )}
      {editing && (
        <div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-3">Editing: {editing.title}</p>
          <AuditForm initial={auditToForm(editing)} onSave={handleEdit} onCancel={() => setEditing(null)} saving={saving} />
        </div>
      )}

      {/* Items grouped by category */}
      {grouped.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm text-slate-600 font-mono">
            {items.length === 0 ? 'No audit items yet — seed or add your first item' : 'No items match the current filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(({ cat, items: catItems }) => (
            <AuditCategorySection
              key={cat.id}
              cat={cat}
              items={catItems}
              onEdit={a => { setEditing(a); setShowAdd(false); }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TIER 2 — IP FUNDING & ACCESS
// ──────────────────────────────────────────────────────────────────────────────

interface FundingFormValues {
  program_type:     FundingType;
  name:             string;
  provider:         string;
  description:      string;
  status:           FundingStatus;
  min_amount_pence: string;
  max_amount_pence: string;
  deadline:         string;
  url:              string;
  lead_contact:     string;
  notes:            string;
}

const BLANK_FUNDING: FundingFormValues = {
  program_type:     'grant',
  name:             '',
  provider:         '',
  description:      '',
  status:           'researching',
  min_amount_pence: '',
  max_amount_pence: '',
  deadline:         '',
  url:              '',
  lead_contact:     '',
  notes:            '',
};

function fundingToForm(f: FundingItem): FundingFormValues {
  return {
    program_type:     f.program_type,
    name:             f.name,
    provider:         f.provider,
    description:      f.description      ?? '',
    status:           f.status,
    min_amount_pence: f.min_amount_pence != null ? String(f.min_amount_pence / 100) : '',
    max_amount_pence: f.max_amount_pence != null ? String(f.max_amount_pence / 100) : '',
    deadline:         f.deadline         ?? '',
    url:              f.url              ?? '',
    lead_contact:     f.lead_contact     ?? '',
    notes:            f.notes            ?? '',
  };
}

function FundingForm({ initial, onSave, onCancel, saving }: {
  initial: FundingFormValues;
  onSave: (f: FundingFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FundingFormValues>(initial);
  function field<K extends keyof FundingFormValues>(k: K, v: FundingFormValues[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="bg-slate-900 border border-sky-500/20 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Programme Type *</FieldLabel>
          <select value={form.program_type} onChange={e => field('program_type', e.target.value as FundingType)} className={inputCls}>
            {FUNDING_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Status</FieldLabel>
          <select value={form.status} onChange={e => field('status', e.target.value as FundingStatus)} className={inputCls}>
            {FUNDING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Name *</FieldLabel>
          <input value={form.name} onChange={e => field('name', e.target.value)} placeholder="Programme name" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Provider *</FieldLabel>
          <input value={form.provider} onChange={e => field('provider', e.target.value)} placeholder="UK IPO, Innovate UK..." className={inputCls} />
        </div>
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="What this programme offers..." className={`${inputCls} resize-none`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <FieldLabel>Min Amount (£)</FieldLabel>
          <input type="number" min="0" value={form.min_amount_pence} onChange={e => field('min_amount_pence', e.target.value)} placeholder="e.g. 10000" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Max Amount (£)</FieldLabel>
          <input type="number" min="0" value={form.max_amount_pence} onChange={e => field('max_amount_pence', e.target.value)} placeholder="e.g. 500000" className={inputCls} />
        </div>
        <div>
          <FieldLabel>Deadline</FieldLabel>
          <input type="date" value={form.deadline} onChange={e => field('deadline', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>URL</FieldLabel>
          <input value={form.url} onChange={e => field('url', e.target.value)} placeholder="https://..." className={inputCls} />
        </div>
        <div>
          <FieldLabel>Lead Contact</FieldLabel>
          <input value={form.lead_contact} onChange={e => field('lead_contact', e.target.value)} placeholder="Name / email" className={inputCls} />
        </div>
      </div>
      <div>
        <FieldLabel>Notes</FieldLabel>
        <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={2} placeholder="Strategic notes, eligibility tips..." className={`${inputCls} resize-none`} />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => onSave(form)} disabled={saving || !form.name || !form.provider}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save Programme'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function FundingCard({ item, onEdit, onDelete, onStatusChange, deleting }: {
  item: FundingItem;
  onEdit: (i: FundingItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: FundingStatus) => void;
  deleting: boolean;
}) {
  const typeCfg   = FUNDING_TYPE_MAP[item.program_type];
  const statusCfg = FUNDING_STATUS_MAP[item.status] ?? FUNDING_STATUS_MAP.researching;
  const isActive  = ['eligible', 'applied', 'in_progress', 'awarded'].includes(item.status);

  return (
    <div className={`group bg-slate-900 border rounded-xl p-4 hover:border-slate-700 transition-colors ${isActive ? 'border-slate-700' : 'border-slate-800'}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{typeCfg?.icon ?? '💼'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <p className="text-sm font-bold text-white">{item.name}</p>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${statusCfg.cls}`}>{statusCfg.label}</span>
            {typeCfg && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${typeCfg.badge}`}>{typeCfg.label}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-1.5">{item.provider}</p>
          {item.description && <p className="text-xs text-slate-600 mb-2">{item.description}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-600">
            {(item.min_amount_pence || item.max_amount_pence) && (
              <span>
                {item.min_amount_pence && item.max_amount_pence
                  ? `${fmtGBP(item.min_amount_pence)} – ${fmtGBP(item.max_amount_pence)}`
                  : fmtGBP(item.max_amount_pence ?? item.min_amount_pence)}
              </span>
            )}
            {item.deadline && <span>Deadline: <span className="text-slate-400">{fmtDate(item.deadline)}</span></span>}
            {item.lead_contact && <span>Contact: <span className="text-slate-400">{item.lead_contact}</span></span>}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:text-sky-400 transition-colors">
                View programme ↗
              </a>
            )}
          </div>
          {item.notes && <p className="text-[10px] font-mono text-slate-700 italic mt-1.5 max-w-prose">{item.notes}</p>}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <select
            value={item.status}
            onChange={e => onStatusChange(item.id, e.target.value as FundingStatus)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-300 focus:outline-none"
          >
            {FUNDING_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <div className="flex gap-1">
            <button type="button" onClick={() => onEdit(item)}
              className="flex-1 px-2 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors">
              Edit
            </button>
            <button type="button" onClick={() => onDelete(item.id)} disabled={deleting}
              className="px-2 py-1 text-[10px] font-mono rounded-lg border border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40">
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tier2FundingTab({ items: initial, showToast }: {
  items: FundingItem[];
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const [items, setItems] = useState<FundingItem[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<FundingItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<FundingType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FundingStatus | 'active' | 'all'>('all');
  const [, startTransition] = useTransition();

  const activeStatuses: FundingStatus[] = ['eligible', 'applied', 'in_progress', 'awarded'];

  const filtered = items.filter(i =>
    (filterType === 'all' || i.program_type === filterType) &&
    (filterStatus === 'all' || (filterStatus === 'active' ? activeStatuses.includes(i.status) : i.status === filterStatus))
  );

  // Group by type
  const grouped = FUNDING_TYPES.map(t => ({
    type: t,
    items: filtered.filter(i => i.program_type === t.id),
  })).filter(g => g.items.length > 0);

  const totalPipeline = items
    .filter(i => activeStatuses.includes(i.status))
    .reduce((s, i) => s + (i.max_amount_pence ?? 0), 0);

  async function handleAdd(form: FundingFormValues) {
    setSaving(true);
    const res = await apiPost({
      action: 'funding_add',
      ...form,
      min_amount_pence: form.min_amount_pence ? Math.round(parseFloat(form.min_amount_pence) * 100) : null,
      max_amount_pence: form.max_amount_pence ? Math.round(parseFloat(form.max_amount_pence) * 100) : null,
    });
    setSaving(false);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setItems(prev => [res.item as FundingItem, ...prev]);
    setShowAdd(false);
    showToast('Programme added', 'success');
  }

  async function handleEdit(form: FundingFormValues) {
    if (!editing) return;
    setSaving(true);
    const res = await apiPost({
      action: 'funding_update',
      id: editing.id,
      ...form,
      min_amount_pence: form.min_amount_pence ? Math.round(parseFloat(form.min_amount_pence) * 100) : null,
      max_amount_pence: form.max_amount_pence ? Math.round(parseFloat(form.max_amount_pence) * 100) : null,
    });
    setSaving(false);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setItems(prev => prev.map(i => i.id === editing.id ? res.item as FundingItem : i));
    setEditing(null);
    showToast('Programme updated', 'success');
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await apiPost({ action: 'funding_delete', id });
      setDeletingId(null);
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setItems(prev => prev.filter(i => i.id !== id));
    });
  }

  async function handleStatusChange(id: string, status: FundingStatus) {
    const res = await apiPost({ action: 'funding_status', id, status });
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setItems(prev => prev.map(i => i.id === id ? res.item as FundingItem : i));
  }

  return (
    <div className="space-y-5">
      {/* Pipeline summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Pipeline', value: String(items.filter(i => activeStatuses.includes(i.status)).length), sub: 'programmes in flight', accent: 'text-sky-400' },
          { label: 'Total Opportunities', value: String(items.length), sub: 'across all types', accent: 'text-white' },
          { label: 'Awarded', value: String(items.filter(i => i.status === 'awarded').length), sub: 'programmes secured', accent: 'text-emerald-400' },
          { label: 'Max Pipeline Value', value: totalPipeline > 0 ? fmtGBP(totalPipeline) : '—', sub: 'active programmes combined', accent: 'text-amber-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.accent}`}>{stat.value}</p>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-sky-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus(s => s === 'active' ? 'all' : 'active')}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${filterStatus === 'active' ? 'bg-sky-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            Active ({items.filter(i => activeStatuses.includes(i.status)).length})
          </button>
          {FUNDING_TYPES.map(t => {
            const count = items.filter(i => i.program_type === t.id).length;
            if (count === 0) return null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterType(f => f === t.id ? 'all' : t.id)}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${filterType === t.id ? 'bg-sky-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {t.icon} {t.label} ({count})
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { setShowAdd(v => !v); setEditing(null); }}
          className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add Programme'}
        </button>
      </div>

      {/* Add / edit form */}
      {showAdd && (
        <FundingForm initial={BLANK_FUNDING} onSave={handleAdd} onCancel={() => setShowAdd(false)} saving={saving} />
      )}
      {editing && (
        <div>
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-3">Editing: {editing.name}</p>
          <FundingForm initial={fundingToForm(editing)} onSave={handleEdit} onCancel={() => setEditing(null)} saving={saving} />
        </div>
      )}

      {/* Items grouped by type */}
      {grouped.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl">
          <p className="text-sm text-slate-600 font-mono">
            {items.length === 0 ? 'No funding programmes yet — seed or add your first one' : 'No programmes match the current filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ type, items: typeItems }) => (
            <div key={type.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{type.icon}</span>
                <h3 className="text-sm font-bold text-slate-300">{type.label}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${type.badge}`}>{typeItems.length}</span>
              </div>
              <div className="space-y-2">
                {typeItems.map(item => (
                  <FundingCard
                    key={item.id}
                    item={item}
                    onEdit={i => { setEditing(i); setShowAdd(false); }}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                    deleting={deletingId === item.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

interface Props {
  initialAuditItems:   AuditItem[];
  initialFundingItems: FundingItem[];
}

export default function IPReadinessClient({ initialAuditItems, initialFundingItems }: Props) {
  const [auditItems,   setAuditItems]   = useState<AuditItem[]>(initialAuditItems);
  const [fundingItems, setFundingItems] = useState<FundingItem[]>(initialFundingItems);
  const [tab, setTab] = useState<MainTab>('tier1');
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [seeding, setSeeding] = useState(false);

  function showToast(message: string, kind: 'success' | 'error') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSeed() {
    setSeeding(true);
    const res = await apiPost({ action: 'seed' });
    setSeeding(false);
    if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
    setAuditItems(res.auditItems ?? []);
    setFundingItems(res.fundingItems ?? []);
    showToast('Seeded with recommended audit items and funding programmes', 'success');
  }

  const isEmpty = auditItems.length === 0 && fundingItems.length === 0;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} kind={toast.kind} />}

      {/* Readiness summary */}
      <ReadinessSummary auditItems={auditItems} fundingItems={fundingItems} />

      {/* Tab selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabBar active={tab} onChange={setTab} />

        {isEmpty && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="px-4 py-2 text-sm font-mono font-bold rounded-xl border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
          >
            {seeding ? 'Seeding…' : '⚡ Seed recommended items'}
          </button>
        )}
      </div>

      {/* Tab content */}
      {tab === 'tier1' && (
        <Tier1AuditTab items={auditItems} showToast={showToast} />
      )}
      {tab === 'tier2' && (
        <Tier2FundingTab items={fundingItems} showToast={showToast} />
      )}
    </div>
  );
}
