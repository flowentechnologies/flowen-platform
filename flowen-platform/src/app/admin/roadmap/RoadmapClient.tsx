'use client';

import React, { useState, useTransition, useMemo } from 'react';
import type { RoadmapMilestone } from '@/app/api/admin/roadmap/route';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase    = RoadmapMilestone['phase'];
type Category = RoadmapMilestone['category'];
type Status   = RoadmapMilestone['status'];
type Priority = RoadmapMilestone['priority'];

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<Phase, { label: string; shortLabel: string; accent: string; bar: string; pill: string }> = {
  launch: {
    label:      'Phase 1 — Launch',
    shortLabel: 'Launch',
    accent:     'emerald',
    bar:        'bg-emerald-500',
    pill:       'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  },
  nhs_pilot: {
    label:      'Phase 2 — NHS Pilot',
    shortLabel: 'NHS Pilot',
    accent:     'amber',
    bar:        'bg-amber-500',
    pill:       'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
  scale: {
    label:      'Phase 3 — Scale',
    shortLabel: 'Scale',
    accent:     'slate',
    bar:        'bg-slate-500',
    pill:       'bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-600/40',
  },
};

const CATEGORY_CONFIG: Record<Category, { label: string; badge: string }> = {
  product:     { label: 'Product',     badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/30' },
  compliance:  { label: 'Compliance',  badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
  commercial:  { label: 'Commercial',  badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  fundraising: { label: 'Fundraising', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  team:        { label: 'Team',        badge: 'bg-slate-600/40 text-slate-600 dark:text-slate-300 border border-slate-600/40' },
};

const STATUS_CONFIG: Record<Status, { label: string; badge: string }> = {
  planned:     { label: 'Planned',     badge: 'bg-slate-700 text-slate-600 dark:text-slate-300' },
  in_progress: { label: 'In Progress', badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/40' },
  complete:    { label: 'Complete',    badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' },
  blocked:     { label: 'Blocked',     badge: 'bg-red-500/20 text-red-400 border border-red-500/40' },
  deferred:    { label: 'Deferred',    badge: 'bg-slate-600/40 text-slate-500' },
};

const PRIORITY_DOT: Record<Priority, string> = {
  critical: 'bg-red-500',
  high:     'bg-amber-500',
  medium:   'bg-slate-500',
  low:      'bg-slate-700',
};

const PHASE_ORDER: Phase[] = ['launch', 'nhs_pilot', 'scale'];

const CATEGORY_FILTER_OPTIONS: { value: Category | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'product',     label: 'Product' },
  { value: 'compliance',  label: 'Compliance' },
  { value: 'commercial',  label: 'Commercial' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'team',        label: 'Team' },
];

const STATUS_FILTER_OPTIONS: { value: Status | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'planned',     label: 'Planned' },
  { value: 'complete',    label: 'Complete' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'deferred',    label: 'Deferred' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function isOverdue(m: RoadmapMilestone): boolean {
  if (!m.target_date || m.status === 'complete' || m.status === 'deferred') return false;
  return new Date(m.target_date + 'T00:00:00') < new Date();
}

function isDueSoon(m: RoadmapMilestone): boolean {
  if (!m.target_date || m.status === 'complete' || m.status === 'deferred') return false;
  const diff = new Date(m.target_date + 'T00:00:00').getTime() - Date.now();
  return diff >= 0 && diff <= 30 * 86_400_000;
}

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/roadmap', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  return res.json() as Promise<{
    milestone?: RoadmapMilestone;
    milestones?: RoadmapMilestone[];
    ok?: boolean;
    error?: string;
  }>;
}

// ── Form helpers ──────────────────────────────────────────────────────────────

type MilestoneForm = {
  phase:        Phase;
  category:     Category;
  title:        string;
  description:  string;
  status:       Status;
  priority:     Priority;
  target_date:  string;
  completed_at: string;
  owner:        string;
  notes:        string;
};

function blankForm(): MilestoneForm {
  return {
    phase:        'launch',
    category:     'product',
    title:        '',
    description:  '',
    status:       'planned',
    priority:     'medium',
    target_date:  '',
    completed_at: '',
    owner:        '',
    notes:        '',
  };
}

function milestoneToForm(m: RoadmapMilestone): MilestoneForm {
  return {
    phase:        m.phase,
    category:     m.category,
    title:        m.title,
    description:  m.description  ?? '',
    status:       m.status,
    priority:     m.priority,
    target_date:  m.target_date  ?? '',
    completed_at: m.completed_at ?? '',
    owner:        m.owner        ?? '',
    notes:        m.notes        ?? '',
  };
}

function formToPayload(f: MilestoneForm): Record<string, unknown> {
  return {
    phase:        f.phase,
    category:     f.category,
    title:        f.title,
    description:  f.description  || null,
    status:       f.status,
    priority:     f.priority,
    target_date:  f.target_date  || null,
    completed_at: f.completed_at || null,
    owner:        f.owner        || null,
    notes:        f.notes        || null,
  };
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
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

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
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

function SelectInput<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SlidePanel({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="14" y2="14" /><line x1="14" y1="4" x2="4" y2="14" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </>
  );
}

// ── Phase progress bar ────────────────────────────────────────────────────────

function PhaseProgressBlock({
  phase, milestones,
}: {
  phase: Phase;
  milestones: RoadmapMilestone[];
}) {
  const cfg    = PHASE_CONFIG[phase];
  const total  = milestones.length;
  const done   = milestones.filter(m => m.status === 'complete').length;
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);

  const nextCritical = milestones
    .filter(m => m.priority === 'critical' && m.status !== 'complete' && m.target_date)
    .sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''))[0];

  const isActive = phase === 'launch';

  return (
    <div className={`flex-1 bg-white dark:bg-slate-900 border rounded-2xl p-5 ${isActive ? 'border-emerald-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${cfg.pill}`}>
            {cfg.shortLabel}
          </span>
          {isActive && (
            <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ACTIVE
            </span>
          )}
        </div>
        <span className={`text-xl font-black ${isActive ? 'text-emerald-400' : phase === 'nhs_pilot' ? 'text-amber-400' : 'text-slate-400'}`}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${cfg.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-[10px] font-mono text-slate-500 mb-2">
        {done}/{total} milestones complete
      </p>

      {nextCritical && (
        <p className="text-[10px] font-mono text-slate-600">
          Next critical:{' '}
          <span className="text-slate-400">{fmtMonthYear(nextCritical.target_date)}</span>
        </p>
      )}
    </div>
  );
}

// ── Milestone card ────────────────────────────────────────────────────────────

function MilestoneCard({ milestone, onEdit }: {
  milestone: RoadmapMilestone;
  onEdit: (m: RoadmapMilestone) => void;
}) {
  const overdue   = isOverdue(milestone);
  const dueSoon   = isDueSoon(milestone);
  const statusCfg = STATUS_CONFIG[milestone.status];
  const catCfg    = CATEGORY_CONFIG[milestone.category];
  const dotCls    = PRIORITY_DOT[milestone.priority];
  const isPulse   = milestone.priority === 'critical';
  const isInProg  = milestone.status === 'in_progress';

  return (
    <div className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors">
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className="mt-1.5 shrink-0">
          <span className={`relative flex h-2 w-2`}>
            {isPulse && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotCls} opacity-60`} />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${dotCls}`} />
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${catCfg.badge}`}>
                  {catCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${statusCfg.badge}`}>
                  {isInProg && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  )}
                  {statusCfg.label}
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{milestone.title}</p>

              {/* Description */}
              {milestone.description && (
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                  {milestone.description}
                </p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                {milestone.owner && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500">
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                    {milestone.owner}
                  </span>
                )}
                {milestone.status === 'complete' && milestone.completed_at && (
                  <span className="text-[10px] font-mono text-emerald-600">
                    Completed {fmtDate(milestone.completed_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Right: date + edit */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              {milestone.target_date && (
                <span className={`text-[10px] font-mono ${
                  overdue  ? 'text-red-400' :
                  dueSoon  ? 'text-amber-400' :
                  'text-slate-500'
                }`}>
                  {overdue ? 'Overdue · ' : dueSoon ? 'Due soon · ' : ''}{fmtDate(milestone.target_date)}
                </span>
              )}
              {!milestone.target_date && (
                <span className="text-[10px] font-mono text-slate-700">No date</span>
              )}
              <button
                type="button"
                onClick={() => onEdit(milestone)}
                className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-all"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Milestone form ────────────────────────────────────────────────────────────

function MilestoneFormContent({ initial, onSave, onCancel, isPending, isEdit }: {
  initial: MilestoneForm;
  onSave: (f: MilestoneForm) => void;
  onCancel: () => void;
  isPending: boolean;
  isEdit: boolean;
}) {
  const [form, setForm] = useState<MilestoneForm>(initial);
  function field<K extends keyof MilestoneForm>(k: K, v: MilestoneForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Phase</Label>
          <SelectInput
            value={form.phase}
            onChange={v => field('phase', v)}
            options={[
              { value: 'launch',    label: 'Phase 1 — Launch' },
              { value: 'nhs_pilot', label: 'Phase 2 — NHS Pilot' },
              { value: 'scale',     label: 'Phase 3 — Scale' },
            ]}
          />
        </div>
        <div>
          <Label>Category</Label>
          <SelectInput
            value={form.category}
            onChange={v => field('category', v)}
            options={[
              { value: 'product',     label: 'Product' },
              { value: 'compliance',  label: 'Compliance' },
              { value: 'commercial',  label: 'Commercial' },
              { value: 'fundraising', label: 'Fundraising' },
              { value: 'team',        label: 'Team' },
            ]}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Title *</Label>
          <Input value={form.title} onChange={v => field('title', v)} placeholder="Milestone title" />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={v => field('description', v)} placeholder="What does completing this milestone involve?" rows={2} />
        </div>
        <div>
          <Label>Status</Label>
          <SelectInput
            value={form.status}
            onChange={v => field('status', v)}
            options={[
              { value: 'planned',     label: 'Planned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'complete',    label: 'Complete' },
              { value: 'blocked',     label: 'Blocked' },
              { value: 'deferred',    label: 'Deferred' },
            ]}
          />
        </div>
        <div>
          <Label>Priority</Label>
          <SelectInput
            value={form.priority}
            onChange={v => field('priority', v)}
            options={[
              { value: 'critical', label: 'Critical' },
              { value: 'high',     label: 'High' },
              { value: 'medium',   label: 'Medium' },
              { value: 'low',      label: 'Low' },
            ]}
          />
        </div>
        <div>
          <Label>Target Date</Label>
          <Input value={form.target_date} onChange={v => field('target_date', v)} type="date" />
        </div>
        {form.status === 'complete' && (
          <div>
            <Label>Completed Date</Label>
            <Input value={form.completed_at} onChange={v => field('completed_at', v)} type="date" />
          </div>
        )}
        <div className={form.status === 'complete' ? '' : 'sm:col-span-1'}>
          <Label>Owner</Label>
          <Input value={form.owner} onChange={v => field('owner', v)} placeholder="Name or team" />
        </div>
        <div className="sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={v => field('notes', v)} placeholder="Dependencies, blockers, context..." rows={3} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending || !form.title}
          className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40"
        >
          {isPending ? 'Saving...' : isEdit ? 'Update Milestone' : 'Add Milestone'}
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

// ── Copy roadmap summary ──────────────────────────────────────────────────────

function buildSummary(milestones: RoadmapMilestone[]): string {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const lines: string[] = [`FLOWEN PRODUCT ROADMAP — ${today}`, ''];

  const phaseLabels: Record<Phase, string> = {
    launch:    'PHASE 1: LAUNCH',
    nhs_pilot: 'PHASE 2: NHS PILOT',
    scale:     'PHASE 3: SCALE',
  };

  for (const phase of PHASE_ORDER) {
    const phaseMilestones = milestones
      .filter(m => m.phase === phase)
      .sort((a, b) => {
        if (!a.target_date && !b.target_date) return 0;
        if (!a.target_date) return 1;
        if (!b.target_date) return -1;
        return a.target_date.localeCompare(b.target_date);
      });

    if (phaseMilestones.length === 0) continue;

    lines.push(phaseLabels[phase]);
    for (const m of phaseMilestones) {
      const icon =
        m.status === 'complete'    ? '[DONE]' :
        m.status === 'in_progress' ? '[WIP]'  :
        m.status === 'blocked'     ? '[BLOCKED]' :
        m.status === 'deferred'    ? '[DEFERRED]' :
        '[ ]';
      const date = m.target_date ? ` (target ${fmtMonthYear(m.target_date)})` : '';
      lines.push(`${icon} ${m.title}${date}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// ── Main client ───────────────────────────────────────────────────────────────

type PanelState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; milestone: RoadmapMilestone };

export function RoadmapClient({ initialMilestones }: { initialMilestones: RoadmapMilestone[] }) {
  const [milestones, setMilestones] = useState<RoadmapMilestone[]>(initialMilestones);
  const [panel,      setPanel]      = useState<PanelState>({ mode: 'closed' });
  const [catFilter,  setCatFilter]  = useState<Category | 'all'>('all');
  const [statFilter, setStatFilter] = useState<Status | 'all'>('all');
  const [isPending,  startTrans]    = useTransition();
  const [toast,      setToast]      = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [copied,     setCopied]     = useState(false);

  function showToast(message: string, kind: 'success' | 'error') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2500);
  }

  // ── Filtered milestones ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return milestones.filter(m => {
      if (catFilter  !== 'all' && m.category !== catFilter)  return false;
      if (statFilter !== 'all' && m.status   !== statFilter) return false;
      return true;
    });
  }, [milestones, catFilter, statFilter]);

  // ── Phase buckets ────────────────────────────────────────────────────────────

  const byPhase = useMemo(() => {
    return PHASE_ORDER.reduce<Record<Phase, RoadmapMilestone[]>>((acc, ph) => {
      acc[ph] = filtered.filter(m => m.phase === ph);
      return acc;
    }, { launch: [], nhs_pilot: [], scale: [] });
  }, [filtered]);

  const byPhaseAll = useMemo(() => {
    return PHASE_ORDER.reduce<Record<Phase, RoadmapMilestone[]>>((acc, ph) => {
      acc[ph] = milestones.filter(m => m.phase === ph);
      return acc;
    }, { launch: [], nhs_pilot: [], scale: [] });
  }, [milestones]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  function handleAdd(form: MilestoneForm) {
    startTrans(async () => {
      const res = await apiPost({ action: 'add', ...formToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setMilestones(prev => [...prev, res.milestone!].sort(sortCmp));
      setPanel({ mode: 'closed' });
      showToast('Milestone added', 'success');
    });
  }

  function handleUpdate(id: string, form: MilestoneForm) {
    startTrans(async () => {
      const res = await apiPost({ action: 'update', id, ...formToPayload(form) });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setMilestones(prev => prev.map(m => m.id === id ? res.milestone! : m).sort(sortCmp));
      setPanel({ mode: 'closed' });
      showToast('Milestone updated', 'success');
    });
  }

  function handleDelete(id: string) {
    startTrans(async () => {
      const res = await apiPost({ action: 'delete', id });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      setMilestones(prev => prev.filter(m => m.id !== id));
      setPanel({ mode: 'closed' });
      showToast('Milestone deleted', 'success');
    });
  }

  function handleSeed() {
    startTrans(async () => {
      const res = await apiPost({ action: 'seed' });
      if (res.error) { showToast(`Error: ${res.error}`, 'error'); return; }
      if (res.milestones) setMilestones(res.milestones);
      showToast('Roadmap seeded with example milestones', 'success');
    });
  }

  function handleCopy() {
    const text = buildSummary(milestones);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Sort comparator ──────────────────────────────────────────────────────────

  function sortCmp(a: RoadmapMilestone, b: RoadmapMilestone): number {
    const PHASE_ORDER_MAP: Record<Phase, number> = { launch: 0, nhs_pilot: 1, scale: 2 };
    const pa = PHASE_ORDER_MAP[a.phase] ?? 99;
    const pb = PHASE_ORDER_MAP[b.phase] ?? 99;
    if (pa !== pb) return pa - pb;
    if (!a.target_date && !b.target_date) return 0;
    if (!a.target_date) return 1;
    if (!b.target_date) return -1;
    return a.target_date.localeCompare(b.target_date);
  }

  const isEmpty = milestones.length === 0;

  return (
    <div className="space-y-6">

      {/* Header: pills + copy button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {PHASE_ORDER.map(ph => (
            <span key={ph} className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest ${PHASE_CONFIG[ph].pill}`}>
              {PHASE_CONFIG[ph].shortLabel.toUpperCase()}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={isEmpty}
            className="px-4 py-2 text-xs font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors disabled:opacity-40"
          >
            {copied ? 'Copied!' : 'Copy Roadmap Summary'}
          </button>
          <button
            type="button"
            onClick={() => setPanel({ mode: 'add' })}
            className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors"
          >
            + Add Milestone
          </button>
        </div>
      </div>

      {/* Phase progress strip */}
      <div className="flex flex-col sm:flex-row gap-3">
        {PHASE_ORDER.map(ph => (
          <PhaseProgressBlock key={ph} phase={ph} milestones={byPhaseAll[ph]} />
        ))}
      </div>

      {/* Filter row */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-4">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            {CATEGORY_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCatFilter(opt.value)}
                className={`px-3 py-1 text-[11px] font-mono rounded-full transition-colors ${
                  catFilter === opt.value
                    ? 'bg-slate-700 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px bg-slate-100 dark:bg-slate-800 self-stretch hidden sm:block" />

          {/* Status filter */}
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatFilter(opt.value)}
                className={`px-3 py-1 text-[11px] font-mono rounded-full transition-colors ${
                  statFilter === opt.value
                    ? 'bg-slate-700 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <p className="text-sm font-bold text-slate-900 dark:text-white mb-2">No roadmap milestones yet</p>
          <p className="text-xs text-slate-500 font-mono mb-2 max-w-md mx-auto">
            Track progress across three phases: Phase 1 Launch (clinical safety, App Store, first users),
            Phase 2 NHS Pilot (ICB contracts, DSPT, 500 users), Phase 3 Scale (10 ICBs, Series A).
          </p>
          <p className="text-[11px] text-slate-600 font-mono mb-6">
            Seed with Flowen&apos;s pre-built milestones or add your own.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleSeed}
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40"
            >
              {isPending ? 'Seeding...' : 'Seed Example Roadmap'}
            </button>
            <button
              type="button"
              onClick={() => setPanel({ mode: 'add' })}
              className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Add Manually
            </button>
          </div>
        </div>
      )}

      {/* Timeline view — grouped by phase */}
      {!isEmpty && (
        <div className="space-y-8">
          {PHASE_ORDER.map(ph => {
            const phaseMilestones = byPhase[ph];
            if (phaseMilestones.length === 0 && (catFilter !== 'all' || statFilter !== 'all')) return null;

            const cfg   = PHASE_CONFIG[ph];
            const total = byPhaseAll[ph].length;
            const done  = byPhaseAll[ph].filter(m => m.status === 'complete').length;

            return (
              <div key={ph}>
                {/* Phase header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">{cfg.label}</h2>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  <span className="text-[10px] font-mono text-slate-600">{done}/{total}</span>
                </div>

                {phaseMilestones.length === 0 && (
                  <p className="text-xs font-mono text-slate-700 px-1">
                    No milestones match current filters for this phase.
                  </p>
                )}

                <div className="space-y-3">
                  {phaseMilestones.map(m => (
                    <MilestoneCard
                      key={m.id}
                      milestone={m}
                      onEdit={m => setPanel({ mode: 'edit', milestone: m })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-in panel: Add */}
      {panel.mode === 'add' && (
        <SlidePanel title="Add Milestone" onClose={() => setPanel({ mode: 'closed' })}>
          <MilestoneFormContent
            initial={blankForm()}
            onSave={handleAdd}
            onCancel={() => setPanel({ mode: 'closed' })}
            isPending={isPending}
            isEdit={false}
          />
        </SlidePanel>
      )}

      {/* Slide-in panel: Edit */}
      {panel.mode === 'edit' && (
        <SlidePanel title="Edit Milestone" onClose={() => setPanel({ mode: 'closed' })}>
          <MilestoneFormContent
            initial={milestoneToForm(panel.milestone)}
            onSave={f => handleUpdate(panel.milestone.id, f)}
            onCancel={() => setPanel({ mode: 'closed' })}
            isPending={isPending}
            isEdit={true}
          />
          <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleDelete(panel.milestone.id)}
              disabled={isPending}
              className="px-4 py-2 text-xs font-mono text-red-500 hover:text-red-400 border border-red-900/40 hover:border-red-800/60 rounded-xl transition-colors disabled:opacity-40"
            >
              Delete this milestone
            </button>
          </div>
        </SlidePanel>
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
