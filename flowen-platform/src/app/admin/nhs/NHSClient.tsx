'use client';

import React, { useState, useTransition } from 'react';
import type { ICBContact, SLPSignup, BlockPledge } from '@/app/api/admin/nhs/route';

// ── Constants ─────────────────────────────────────────────────────────────────

const NHS_MILESTONE_DATE = new Date('2027-04-01');
const PLEDGE_TARGET_PENCE = 500_000 * 100; // £500k

// ── Helpers ───────────────────────────────────────────────────────────────────

function pence(p: number | null | undefined, fallback = '—'): string {
  if (p == null) return fallback;
  if (p === 0) return '£0';
  if (p >= 1_000_000_00) return `£${(p / 1_000_000_00).toFixed(2)}m`;
  if (p >= 100_000) return `£${(p / 100_000).toFixed(0)}k`;
  return `£${(p / 100).toLocaleString('en-GB')}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(target: Date): number {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/nhs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ data?: unknown; error?: string; ok?: boolean }>;
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

// ── Form primitives ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 disabled:opacity-50"
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
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
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
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/50"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type Tab = 'icb' | 'slp' | 'pledges';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'icb',     label: 'ICB Pipeline' },
    { id: 'slp',     label: 'SLP Portal' },
    { id: 'pledges', label: 'Block Pledges' },
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

// ── Page header strip ─────────────────────────────────────────────────────────

function PageHeader({
  icbContacts,
  slpSignups,
  blockPledges,
}: {
  icbContacts: ICBContact[];
  slpSignups: SLPSignup[];
  blockPledges: BlockPledge[];
}) {
  const daysLeft = daysUntil(NHS_MILESTONE_DATE);

  const signedLivePledges = blockPledges.filter(p => p.status === 'signed' || p.status === 'live');
  const pledgedPence = signedLivePledges.reduce((s, p) => s + (p.contract_value_pence ?? 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-600/20 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Milestone countdown */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-3 text-center min-w-[80px]">
            <p className="text-2xl font-black text-blue-400">{daysLeft}</p>
            <p className="text-[9px] font-mono text-blue-500/70 uppercase tracking-wider">days</p>
          </div>
          <div>
            <p className="text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">NHS Clinical Block Trials</p>
            <p className="text-[11px] text-slate-500 font-mono">Target: Q2 2027 (01 Apr 2027)</p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4 text-right">
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{icbContacts.length}</p>
            <p className="text-[10px] font-mono text-slate-500">ICBs tracked</p>
          </div>
          <div className="w-px bg-slate-100 dark:bg-slate-800 self-stretch" />
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{slpSignups.length}</p>
            <p className="text-[10px] font-mono text-slate-500">SLPs registered</p>
          </div>
          <div className="w-px bg-slate-100 dark:bg-slate-800 self-stretch" />
          <div>
            <p className="text-2xl font-black text-blue-400">{pence(pledgedPence, '£0')}</p>
            <p className="text-[10px] font-mono text-slate-500">pledged (signed+live)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ICB PIPELINE TAB
// ══════════════════════════════════════════════════════════════════════════════

type ICBStage = 'prospecting' | 'engaged' | 'proposal' | 'pilot' | 'contract' | 'declined';

const ICB_STAGES: ICBStage[] = ['prospecting', 'engaged', 'proposal', 'pilot', 'contract', 'declined'];

const ICB_STAGE_CONFIG: Record<ICBStage, { label: string; badge: string; funnel: string }> = {
  prospecting: { label: 'Prospecting', badge: 'bg-slate-700 text-slate-600 dark:text-slate-300',                                             funnel: 'bg-slate-600' },
  engaged:     { label: 'Engaged',     badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',                     funnel: 'bg-sky-500' },
  proposal:    { label: 'Proposal',    badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',               funnel: 'bg-amber-500' },
  pilot:       { label: 'Pilot',       badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',            funnel: 'bg-purple-500' },
  contract:    { label: 'Contract',    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',         funnel: 'bg-emerald-500' },
  declined:    { label: 'Declined',    badge: 'bg-red-900/30 text-red-500/70',                                           funnel: 'bg-red-800' },
};

function ICBStageBadge({ stage }: { stage: string }) {
  const cfg = ICB_STAGE_CONFIG[stage as ICBStage] ?? { label: stage, badge: 'bg-slate-700 text-slate-600 dark:text-slate-300' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

type ICBForm = {
  icb_name: string;
  region: string;
  stage: ICBStage;
  contact_name: string;
  contact_email: string;
  contact_role: string;
  last_contact_at: string;
  next_action: string;
  patient_population: string;
  notes: string;
};

function blankICBForm(): ICBForm {
  return {
    icb_name: '', region: '', stage: 'prospecting',
    contact_name: '', contact_email: '', contact_role: '',
    last_contact_at: '', next_action: '', patient_population: '', notes: '',
  };
}

function icbToForm(c: ICBContact): ICBForm {
  return {
    icb_name:           c.icb_name,
    region:             c.region           ?? '',
    stage:              (c.stage as ICBStage) ?? 'prospecting',
    contact_name:       c.contact_name     ?? '',
    contact_email:      c.contact_email    ?? '',
    contact_role:       c.contact_role     ?? '',
    last_contact_at:    c.last_contact_at  ? c.last_contact_at.slice(0, 10) : '',
    next_action:        c.next_action      ?? '',
    patient_population: c.patient_population != null ? String(c.patient_population) : '',
    notes:              c.notes            ?? '',
  };
}

function icbFormToPayload(f: ICBForm): Record<string, unknown> {
  return {
    icb_name:           f.icb_name,
    region:             f.region             || null,
    stage:              f.stage,
    contact_name:       f.contact_name       || null,
    contact_email:      f.contact_email      || null,
    contact_role:       f.contact_role       || null,
    last_contact_at:    f.last_contact_at    || null,
    next_action:        f.next_action        || null,
    patient_population: f.patient_population ? parseInt(f.patient_population, 10) : null,
    notes:              f.notes              || null,
  };
}

function ICBFormPanel({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: ICBForm;
  onSave: (f: ICBForm) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ICBForm>(initial);
  function field<K extends keyof ICBForm>(k: K, v: ICBForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-500/20 rounded-2xl p-5 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <Label>ICB Name *</Label>
          <Input value={form.icb_name} onChange={v => field('icb_name', v)} placeholder="e.g. NHS South West London ICB" />
        </div>
        <div>
          <Label>Region</Label>
          <Input value={form.region} onChange={v => field('region', v)} placeholder="e.g. London, North West" />
        </div>
        <div>
          <Label>Stage</Label>
          <Select
            value={form.stage}
            onChange={v => field('stage', v as ICBStage)}
            options={ICB_STAGES.map(s => ({ value: s, label: ICB_STAGE_CONFIG[s].label }))}
          />
        </div>
        <div>
          <Label>Contact Name</Label>
          <Input value={form.contact_name} onChange={v => field('contact_name', v)} placeholder="Full name" />
        </div>
        <div>
          <Label>Contact Email</Label>
          <Input value={form.contact_email} onChange={v => field('contact_email', v)} placeholder="name@nhs.net" type="email" />
        </div>
        <div>
          <Label>Contact Role</Label>
          <Input value={form.contact_role} onChange={v => field('contact_role', v)} placeholder="e.g. Commissioning Manager" />
        </div>
        <div>
          <Label>Last Contact</Label>
          <Input value={form.last_contact_at} onChange={v => field('last_contact_at', v)} type="date" />
        </div>
        <div>
          <Label>Patient Population</Label>
          <Input value={form.patient_population} onChange={v => field('patient_population', v)} placeholder="e.g. 750000" type="number" />
        </div>
        <div>
          <Label>Next Action</Label>
          <Input value={form.next_action} onChange={v => field('next_action', v)} placeholder="e.g. Send proposal, Book call" />
        </div>
      </div>
      <div className="mb-4">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={v => field('notes', v)} placeholder="Meeting notes, contacts, context..." rows={2} />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending || !form.icb_name}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save ICB'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ICBFunnel({ contacts }: { contacts: ICBContact[] }) {
  const activeFunnel: ICBStage[] = ['prospecting', 'engaged', 'proposal', 'pilot', 'contract'];
  const total = contacts.filter(c => c.stage !== 'declined').length || 1;

  const counts: Record<ICBStage, number> = {
    prospecting: 0, engaged: 0, proposal: 0, pilot: 0, contract: 0, declined: 0,
  };
  contacts.forEach(c => {
    counts[c.stage as ICBStage] = (counts[c.stage as ICBStage] ?? 0) + 1;
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-4">Pipeline Funnel</p>
      <div className="space-y-2">
        {activeFunnel.map(stage => {
          const count = counts[stage];
          const pct = Math.round((count / total) * 100);
          const cfg = ICB_STAGE_CONFIG[stage];
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500 w-24 shrink-0">{cfg.label}</span>
              <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
                <div
                  className={`h-full ${cfg.funnel} rounded-md transition-all duration-500 flex items-center px-2`}
                  style={{ width: count === 0 ? '2px' : `${Math.max(4, pct)}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white w-6 text-right shrink-0">{count}</span>
            </div>
          );
        })}
      </div>
      {counts.declined > 0 && (
        <p className="text-[10px] font-mono text-slate-600 mt-3">{counts.declined} declined (hidden from funnel)</p>
      )}
    </div>
  );
}

function ICBTab({
  contacts,
  onAdd,
  onUpdate,
  onDelete,
  showToast,
}: {
  contacts: ICBContact[];
  onAdd: (c: ICBContact) => void;
  onUpdate: (c: ICBContact) => void;
  onDelete: (id: string) => void;
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const engagedCount   = contacts.filter(c => c.stage !== 'prospecting' && c.stage !== 'declined').length;
  const pilotCount     = contacts.filter(c => c.stage === 'pilot').length;
  const contractCount  = contacts.filter(c => c.stage === 'contract').length;

  function handleAdd(form: ICBForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'add_icb', ...icbFormToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onAdd(res.data as ICBContact);
      setShowAddForm(false);
      showToast('ICB contact added', 'success');
    });
  }

  function handleUpdate(id: string, form: ICBForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'update_icb', id, ...icbFormToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onUpdate(res.data as ICBContact);
      setEditingId(null);
      showToast('ICB contact updated', 'success');
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this ICB contact?')) return;
    startTransition(async () => {
      const res = await apiPost({ action: 'delete_icb', id });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onDelete(id);
      showToast('ICB contact removed', 'success');
    });
  }

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'ICBs Tracked',   value: contacts.length,  accent: 'text-slate-900 dark:text-white' },
          { label: 'Engaged+',       value: engagedCount,     accent: 'text-sky-400' },
          { label: 'In Pilot',       value: pilotCount,       accent: 'text-purple-400' },
          { label: 'Contracted',     value: contractCount,    accent: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <ICBFunnel contacts={contacts} />

      {/* Table header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest font-mono">ICB Contacts</h2>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add ICB'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <ICBFormPanel
          initial={blankICBForm()}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={isPending}
        />
      )}

      {/* Table */}
      {contacts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-16 text-center">
          <p className="text-slate-600 font-mono text-sm">Add your first ICB contact to track the NHS pipeline</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">ICB</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">Region</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Stage</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden xl:table-cell">Last Contact</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden xl:table-cell">Next Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell">Population</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {contacts.map(c => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{c.icb_name}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="text-[11px] font-mono text-slate-400">{c.region ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <ICBStageBadge stage={c.stage} />
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {c.contact_name ? (
                          <div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300">{c.contact_name}</p>
                            {c.contact_role && <p className="text-[10px] font-mono text-slate-600">{c.contact_role}</p>}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-700">—</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] font-mono text-slate-500 hidden xl:table-cell">
                        {fmtDate(c.last_contact_at)}
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell max-w-[180px]">
                        {c.next_action
                          ? <p className="text-[11px] text-slate-400 truncate">{c.next_action}</p>
                          : <p className="text-[11px] text-slate-700">—</p>}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {c.patient_population != null
                          ? <p className="text-[11px] font-mono text-slate-400">{c.patient_population.toLocaleString()}</p>
                          : <p className="text-[11px] text-slate-700">—</p>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setEditingId(id => id === c.id ? null : c.id)}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === c.id && (
                      <tr>
                        <td colSpan={8} className="px-5 py-4 bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                          <ICBFormPanel
                            initial={icbToForm(c)}
                            onSave={form => handleUpdate(c.id, form)}
                            onCancel={() => setEditingId(null)}
                            isPending={isPending}
                          />
                        </td>
                      </tr>
                    )}
                    {c.notes && editingId !== c.id && (
                      <tr className="hidden group-hover:table-row">
                        <td colSpan={8} className="px-5 pb-2.5">
                          <p className="text-[10px] font-mono text-slate-600 italic">{c.notes}</p>
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

// ══════════════════════════════════════════════════════════════════════════════
// SLP PORTAL TAB
// ══════════════════════════════════════════════════════════════════════════════

type SLPForm = {
  name: string;
  email: string;
  organisation: string;
  role: string;
  region: string;
  signup_date: string;
  activated: boolean;
  patient_referrals: string;
  notes: string;
};

function blankSLPForm(): SLPForm {
  return {
    name: '', email: '', organisation: '', role: '', region: '',
    signup_date: new Date().toISOString().slice(0, 10),
    activated: false, patient_referrals: '0', notes: '',
  };
}

function slpToForm(s: SLPSignup): SLPForm {
  return {
    name:              s.name,
    email:             s.email,
    organisation:      s.organisation      ?? '',
    role:              s.role              ?? '',
    region:            s.region            ?? '',
    signup_date:       s.signup_date       ? s.signup_date.slice(0, 10) : '',
    activated:         s.activated,
    patient_referrals: String(s.patient_referrals ?? 0),
    notes:             s.notes             ?? '',
  };
}

function slpFormToPayload(f: SLPForm): Record<string, unknown> {
  return {
    name:              f.name,
    email:             f.email,
    organisation:      f.organisation      || null,
    role:              f.role              || null,
    region:            f.region            || null,
    signup_date:       f.signup_date       || null,
    activated:         f.activated,
    patient_referrals: parseInt(f.patient_referrals, 10) || 0,
    notes:             f.notes             || null,
  };
}

function SLPFormPanel({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: SLPForm;
  onSave: (f: SLPForm) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<SLPForm>(initial);
  function field<K extends keyof SLPForm>(k: K, v: SLPForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-500/20 rounded-2xl p-5 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <Label>Full Name *</Label>
          <Input value={form.name} onChange={v => field('name', v)} placeholder="Dr Jane Smith" />
        </div>
        <div>
          <Label>Email *</Label>
          <Input value={form.email} onChange={v => field('email', v)} placeholder="jane@nhs.net" type="email" />
        </div>
        <div>
          <Label>Organisation</Label>
          <Input value={form.organisation} onChange={v => field('organisation', v)} placeholder="NHS Trust / clinic name" />
        </div>
        <div>
          <Label>Role</Label>
          <Input value={form.role} onChange={v => field('role', v)} placeholder="e.g. Speech & Language Therapist" />
        </div>
        <div>
          <Label>Region</Label>
          <Input value={form.region} onChange={v => field('region', v)} placeholder="e.g. London, South East" />
        </div>
        <div>
          <Label>Signup Date</Label>
          <Input value={form.signup_date} onChange={v => field('signup_date', v)} type="date" />
        </div>
        <div>
          <Label>Patient Referrals</Label>
          <Input value={form.patient_referrals} onChange={v => field('patient_referrals', v)} type="number" placeholder="0" />
        </div>
      </div>
      <div className="flex items-center gap-6 mb-4">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.activated}
            onChange={e => field('activated', e.target.checked)}
            className="w-4 h-4 rounded border border-slate-600 bg-slate-100 dark:bg-slate-800 accent-emerald-500"
          />
          <span className="text-sm text-slate-600 dark:text-slate-300 font-mono">Activated</span>
        </label>
      </div>
      <div className="mb-4">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={v => field('notes', v)} placeholder="Notes about this SLP..." rows={2} />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending || !form.name || !form.email}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save SLP'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SLPTab({
  signups,
  onAdd,
  onUpdate,
  onDelete,
  showToast,
}: {
  signups: SLPSignup[];
  onAdd: (s: SLPSignup) => void;
  onUpdate: (s: SLPSignup) => void;
  onDelete: (id: string) => void;
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activatedCount   = signups.filter(s => s.activated).length;
  const activatedPct     = signups.length > 0 ? Math.round((activatedCount / signups.length) * 100) : 0;
  const totalReferrals   = signups.reduce((sum, s) => sum + (s.patient_referrals ?? 0), 0);

  function handleAdd(form: SLPForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'add_slp', ...slpFormToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onAdd(res.data as SLPSignup);
      setShowAddForm(false);
      showToast('SLP added', 'success');
    });
  }

  function handleUpdate(id: string, form: SLPForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'update_slp', id, ...slpFormToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onUpdate(res.data as SLPSignup);
      setEditingId(null);
      showToast('SLP updated', 'success');
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this SLP?')) return;
    startTransition(async () => {
      const res = await apiPost({ action: 'delete_slp', id });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onDelete(id);
      showToast('SLP removed', 'success');
    });
  }

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">SLPs Registered</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{signups.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Activated</p>
          <p className="text-3xl font-black text-emerald-400">{activatedPct}%</p>
          <p className="text-[10px] font-mono text-slate-600 mt-1">{activatedCount} of {signups.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Patient Referrals</p>
          <p className="text-3xl font-black text-blue-400">{totalReferrals.toLocaleString()}</p>
        </div>
      </div>

      {/* Flywheel banner */}
      <div className="bg-blue-600/5 border border-blue-600/20 rounded-xl px-5 py-3 flex items-start gap-3">
        <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
          Free SLP access drives the D2C referral flywheel — each clinician reaches approximately{' '}
          <span className="text-blue-400 font-bold">40 patients</span>.
          {signups.length > 0 && (
            <> Estimated reach: <span className="text-slate-900 dark:text-white font-bold">{(signups.length * 40).toLocaleString()} patients</span>.</>
          )}
        </p>
      </div>

      {/* Table header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest font-mono">SLP Registrations</h2>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add SLP'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <SLPFormPanel
          initial={blankSLPForm()}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={isPending}
        />
      )}

      {/* Table */}
      {signups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-16 text-center">
          <p className="text-slate-600 font-mono text-sm">No SLPs registered yet — add the first to start tracking the referral flywheel</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Name</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">Organisation</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell">Region</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden xl:table-cell">Role</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell">Signup</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Activated</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">Referrals</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {signups.map(s => (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{s.name}</p>
                        <p className="text-[10px] text-slate-600">{s.email}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="text-[11px] text-slate-400">{s.organisation ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <p className="text-[11px] font-mono text-slate-500">{s.region ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell max-w-[160px]">
                        <p className="text-[11px] text-slate-400 truncate">{s.role ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] font-mono text-slate-500 hidden lg:table-cell">
                        {fmtDate(s.signup_date)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                          s.activated
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {s.activated ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className={`text-sm font-mono font-bold ${
                          (s.patient_referrals ?? 0) > 0 ? 'text-blue-400' : 'text-slate-700'
                        }`}>
                          {s.patient_referrals ?? 0}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setEditingId(id => id === s.id ? null : s.id)}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === s.id && (
                      <tr>
                        <td colSpan={8} className="px-5 py-4 bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                          <SLPFormPanel
                            initial={slpToForm(s)}
                            onSave={form => handleUpdate(s.id, form)}
                            onCancel={() => setEditingId(null)}
                            isPending={isPending}
                          />
                        </td>
                      </tr>
                    )}
                    {s.notes && editingId !== s.id && (
                      <tr className="hidden group-hover:table-row">
                        <td colSpan={8} className="px-5 pb-2.5">
                          <p className="text-[10px] font-mono text-slate-600 italic">{s.notes}</p>
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

// ══════════════════════════════════════════════════════════════════════════════
// BLOCK PLEDGES TAB
// ══════════════════════════════════════════════════════════════════════════════

type PledgeStatus = 'verbal' | 'written' | 'signed' | 'live';

const PLEDGE_STATUSES: PledgeStatus[] = ['verbal', 'written', 'signed', 'live'];

const PLEDGE_STATUS_CONFIG: Record<PledgeStatus, { label: string; badge: string }> = {
  verbal:  { label: 'Verbal',  badge: 'bg-slate-700 text-slate-600 dark:text-slate-300' },
  written: { label: 'Written', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  signed:  { label: 'Signed',  badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  live:    { label: 'Live',    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse' },
};

function PledgeStatusBadge({ status }: { status: string }) {
  const cfg = PLEDGE_STATUS_CONFIG[status as PledgeStatus] ?? { label: status, badge: 'bg-slate-700 text-slate-600 dark:text-slate-300' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

type PledgeForm = {
  icb_name: string;
  contact_name: string;
  patients_covered: string;
  contract_value_pounds: string;
  status: PledgeStatus;
  expected_start_date: string;
  actual_start_date: string;
  notes: string;
};

function blankPledgeForm(): PledgeForm {
  return {
    icb_name: '', contact_name: '', patients_covered: '',
    contract_value_pounds: '', status: 'verbal',
    expected_start_date: '', actual_start_date: '', notes: '',
  };
}

function pledgeToForm(p: BlockPledge): PledgeForm {
  return {
    icb_name:              p.icb_name,
    contact_name:          p.contact_name          ?? '',
    patients_covered:      p.patients_covered       != null ? String(p.patients_covered)                          : '',
    contract_value_pounds: p.contract_value_pence   != null ? String(Math.round(p.contract_value_pence / 100))   : '',
    status:                (p.status as PledgeStatus) ?? 'verbal',
    expected_start_date:   p.expected_start_date   ?? '',
    actual_start_date:     p.actual_start_date     ?? '',
    notes:                 p.notes                 ?? '',
  };
}

function pledgeFormToPayload(f: PledgeForm): Record<string, unknown> {
  return {
    icb_name:             f.icb_name,
    contact_name:         f.contact_name         || null,
    patients_covered:     f.patients_covered      ? parseInt(f.patients_covered, 10)                         : null,
    contract_value_pence: f.contract_value_pounds ? Math.round(parseFloat(f.contract_value_pounds) * 100)   : null,
    status:               f.status,
    expected_start_date:  f.expected_start_date  || null,
    actual_start_date:    f.actual_start_date    || null,
    notes:                f.notes               || null,
  };
}

function PledgeFormPanel({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: PledgeForm;
  onSave: (f: PledgeForm) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<PledgeForm>(initial);
  function field<K extends keyof PledgeForm>(k: K, v: PledgeForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-blue-500/20 rounded-2xl p-5 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <Label>ICB Name *</Label>
          <Input value={form.icb_name} onChange={v => field('icb_name', v)} placeholder="e.g. NHS Greater Manchester ICB" />
        </div>
        <div>
          <Label>Contact Name</Label>
          <Input value={form.contact_name} onChange={v => field('contact_name', v)} placeholder="Full name" />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onChange={v => field('status', v as PledgeStatus)}
            options={PLEDGE_STATUSES.map(s => ({ value: s, label: PLEDGE_STATUS_CONFIG[s].label }))}
          />
        </div>
        <div>
          <Label>Patients Covered</Label>
          <Input value={form.patients_covered} onChange={v => field('patients_covered', v)} placeholder="e.g. 1000" type="number" />
        </div>
        <div>
          <Label>Contract Value (£)</Label>
          <Input value={form.contract_value_pounds} onChange={v => field('contract_value_pounds', v)} placeholder="e.g. 50000" type="number" />
        </div>
        <div>
          <Label>Expected Start Date</Label>
          <Input value={form.expected_start_date} onChange={v => field('expected_start_date', v)} type="date" />
        </div>
        <div>
          <Label>Actual Start Date</Label>
          <Input value={form.actual_start_date} onChange={v => field('actual_start_date', v)} type="date" />
        </div>
      </div>
      <div className="mb-4">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={v => field('notes', v)} placeholder="Pledge details, conditions, next steps..." rows={2} />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending || !form.icb_name}
          className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Save Pledge'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PledgesTab({
  pledges,
  onAdd,
  onUpdate,
  onDelete,
  showToast,
}: {
  pledges: BlockPledge[];
  onAdd: (p: BlockPledge) => void;
  onUpdate: (p: BlockPledge) => void;
  onDelete: (id: string) => void;
  showToast: (m: string, k: 'success' | 'error') => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const signedLive       = pledges.filter(p => p.status === 'signed' || p.status === 'live');
  const totalPledgedPence = pledges.reduce((s, p) => s + (p.contract_value_pence ?? 0), 0);
  const signedLivePence  = signedLive.reduce((s, p) => s + (p.contract_value_pence ?? 0), 0);
  const totalPatients    = pledges.reduce((s, p) => s + (p.patients_covered ?? 0), 0);
  const progressPct      = Math.min(100, Math.round((signedLivePence / PLEDGE_TARGET_PENCE) * 100));

  function handleAdd(form: PledgeForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'add_pledge', ...pledgeFormToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onAdd(res.data as BlockPledge);
      setShowAddForm(false);
      showToast('Pledge added', 'success');
    });
  }

  function handleUpdate(id: string, form: PledgeForm) {
    startTransition(async () => {
      const res = await apiPost({ action: 'update_pledge', id, ...pledgeFormToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onUpdate(res.data as BlockPledge);
      setEditingId(null);
      showToast('Pledge updated', 'success');
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this pledge?')) return;
    startTransition(async () => {
      const res = await apiPost({ action: 'delete_pledge', id });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      onDelete(id);
      showToast('Pledge removed', 'success');
    });
  }

  return (
    <div className="space-y-5">
      {/* Hero metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Signed + Live Value</p>
          <p className="text-3xl font-black text-emerald-400">{pence(signedLivePence, '£0')}</p>
          <p className="text-[10px] font-mono text-slate-600 mt-1">of £500k target</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Total Pipeline Value</p>
          <p className="text-3xl font-black text-blue-400">{pence(totalPledgedPence, '£0')}</p>
          <p className="text-[10px] font-mono text-slate-600 mt-1">all statuses</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Patients Covered</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{totalPatients.toLocaleString()}</p>
          <p className="text-[10px] font-mono text-slate-600 mt-1">across all pledges</p>
        </div>
      </div>

      {/* Progress bar toward £500k target */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider">Progress to £500k Target</p>
          <p className="text-sm font-mono font-black text-emerald-400">{progressPct}%</p>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.max(progressPct, 0)}%` }}
          />
        </div>
        <div className="flex justify-between">
          <p className="text-[10px] font-mono text-slate-600">{pence(signedLivePence, '£0')} signed / live</p>
          <p className="text-[10px] font-mono text-slate-600">£500k target (placeholder)</p>
        </div>
      </div>

      {/* Table header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest font-mono">Block Pledges</h2>
        <button
          type="button"
          onClick={() => { setShowAddForm(v => !v); setEditingId(null); }}
          className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Pledge'}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <PledgeFormPanel
          initial={blankPledgeForm()}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isPending={isPending}
        />
      )}

      {/* Table */}
      {pledges.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-16 text-center">
          <p className="text-slate-600 font-mono text-sm">No block pledges yet — add the first verbal commitment to start the pipeline</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">ICB</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden lg:table-cell">Patients</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Value</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500 hidden xl:table-cell">Exp. Start</th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pledges.map(p => (
                  <React.Fragment key={p.id}>
                    <tr className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{p.icb_name}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="text-[11px] text-slate-400">{p.contact_name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <p className="text-[11px] font-mono text-slate-400">
                          {p.patients_covered != null ? p.patients_covered.toLocaleString() : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className={`text-sm font-mono font-bold ${
                          p.contract_value_pence != null ? 'text-blue-400' : 'text-slate-700'
                        }`}>
                          {pence(p.contract_value_pence, '—')}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <PledgeStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3.5 text-[11px] font-mono text-slate-500 hidden xl:table-cell">
                        {fmtDate(p.expected_start_date)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setEditingId(id => id === p.id ? null : p.id)}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            disabled={isPending}
                            className="px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === p.id && (
                      <tr>
                        <td colSpan={7} className="px-5 py-4 bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                          <PledgeFormPanel
                            initial={pledgeToForm(p)}
                            onSave={form => handleUpdate(p.id, form)}
                            onCancel={() => setEditingId(null)}
                            isPending={isPending}
                          />
                        </td>
                      </tr>
                    )}
                    {p.notes && editingId !== p.id && (
                      <tr className="hidden group-hover:table-row">
                        <td colSpan={7} className="px-5 pb-2.5">
                          <p className="text-[10px] font-mono text-slate-600 italic">{p.notes}</p>
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN CLIENT
// ══════════════════════════════════════════════════════════════════════════════

export function NHSClient({
  initialICBContacts,
  initialSLPSignups,
  initialBlockPledges,
}: {
  initialICBContacts: ICBContact[];
  initialSLPSignups: SLPSignup[];
  initialBlockPledges: BlockPledge[];
}) {
  const [tab, setTab] = useState<Tab>('icb');
  const [icbContacts, setICBContacts] = useState<ICBContact[]>(initialICBContacts);
  const [slpSignups, setSLPSignups] = useState<SLPSignup[]>(initialSLPSignups);
  const [blockPledges, setBlockPledges] = useState<BlockPledge[]>(initialBlockPledges);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  function showToast(message: string, kind: 'success' | 'error') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icbContacts={icbContacts}
        slpSignups={slpSignups}
        blockPledges={blockPledges}
      />

      <TabBar active={tab} onChange={setTab} />

      {tab === 'icb' && (
        <ICBTab
          contacts={icbContacts}
          onAdd={c => setICBContacts(prev => [c, ...prev])}
          onUpdate={c => setICBContacts(prev => prev.map(x => x.id === c.id ? c : x))}
          onDelete={id => setICBContacts(prev => prev.filter(x => x.id !== id))}
          showToast={showToast}
        />
      )}

      {tab === 'slp' && (
        <SLPTab
          signups={slpSignups}
          onAdd={s => setSLPSignups(prev => [s, ...prev])}
          onUpdate={s => setSLPSignups(prev => prev.map(x => x.id === s.id ? s : x))}
          onDelete={id => setSLPSignups(prev => prev.filter(x => x.id !== id))}
          showToast={showToast}
        />
      )}

      {tab === 'pledges' && (
        <PledgesTab
          pledges={blockPledges}
          onAdd={p => setBlockPledges(prev => [p, ...prev])}
          onUpdate={p => setBlockPledges(prev => prev.map(x => x.id === p.id ? p : x))}
          onDelete={id => setBlockPledges(prev => prev.filter(x => x.id !== id))}
          showToast={showToast}
        />
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
