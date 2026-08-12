'use client';

import React, { useState, useTransition } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkflowStatus = 'active' | 'paused' | 'draft';
type RunStatus = 'success' | 'failed' | 'skipped';
type TriggerType = 'user_event' | 'schedule' | 'manual' | 'webhook';

interface WorkflowStep {
  step: number;
  action: string;
  template?: string;
  delay_hours?: number;
  threshold_days?: number;
  limit?: number;
  channel?: string;
  priority?: string;
  category?: string;
}

interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: RunStatus;
  triggered_by: string;
  duration_ms: number | null;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
  recent_runs?: WorkflowRun[];
}

interface Props {
  initialWorkflows: WorkflowDefinition[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<TriggerType, { label: string; color: string }> = {
  user_event: { label: 'User Event',  color: 'bg-blue-500/10 text-blue-400' },
  schedule:   { label: 'Schedule',    color: 'bg-amber-500/10 text-amber-400' },
  manual:     { label: 'Manual',      color: 'bg-slate-700 text-slate-600 dark:text-slate-300' },
  webhook:    { label: 'Webhook',     color: 'bg-purple-500/10 text-purple-400' },
};

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; dot: string; badge: string }> = {
  active: { label: 'Active', dot: 'bg-emerald-400',              badge: 'bg-emerald-500/10 text-emerald-400' },
  paused: { label: 'Paused', dot: 'bg-amber-400',                badge: 'bg-amber-500/10 text-amber-400' },
  draft:  { label: 'Draft',  dot: 'bg-slate-500',                badge: 'bg-slate-700 text-slate-400' },
};

const RUN_STATUS_CONFIG: Record<RunStatus, { label: string; color: string }> = {
  success: { label: 'Success', color: 'text-emerald-400' },
  failed:  { label: 'Failed',  color: 'text-red-400' },
  skipped: { label: 'Skipped', color: 'text-slate-500' },
};

const TRIGGER_TYPES: TriggerType[] = ['user_event', 'schedule', 'manual', 'webhook'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function apiJson(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json() as Promise<{ data?: WorkflowDefinition | WorkflowRun; error?: string }>;
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

// ── Steps Pipeline ────────────────────────────────────────────────────────────

function StepsPipeline({ steps }: { steps: WorkflowStep[] }) {
  if (steps.length === 0) {
    return <p className="text-[10px] font-mono text-slate-600 italic">No steps configured</p>;
  }
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {steps.map((step, i) => (
        <React.Fragment key={step.step}>
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 min-w-[120px]">
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-wide mb-1">Step {step.step}</p>
            <p className="text-[11px] font-mono text-indigo-300 font-bold">{step.action}</p>
            {step.template && (
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">{step.template}</p>
            )}
            {step.delay_hours !== undefined && step.delay_hours > 0 && (
              <p className="text-[9px] font-mono text-slate-600 mt-0.5">+{step.delay_hours}h delay</p>
            )}
            {step.threshold_days !== undefined && (
              <p className="text-[9px] font-mono text-slate-600 mt-0.5">threshold: {step.threshold_days}d</p>
            )}
            {step.limit !== undefined && (
              <p className="text-[9px] font-mono text-slate-600 mt-0.5">limit: {step.limit}</p>
            )}
            {step.channel && (
              <p className="text-[9px] font-mono text-slate-600 mt-0.5">via {step.channel}</p>
            )}
            {step.priority && (
              <p className="text-[9px] font-mono text-amber-600 mt-0.5">priority: {step.priority}</p>
            )}
          </div>
          {i < steps.length - 1 && (
            <div className="flex items-center text-slate-700 text-xs font-mono select-none">→</div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Run History ───────────────────────────────────────────────────────────────

function RunHistory({ runs }: { runs: WorkflowRun[] }) {
  if (runs.length === 0) {
    return <p className="text-[10px] font-mono text-slate-600 mt-3 italic">No runs recorded yet</p>;
  }
  return (
    <div className="mt-3 space-y-1">
      {runs.slice(0, 5).map(run => {
        const cfg = RUN_STATUS_CONFIG[run.status];
        return (
          <div key={run.id} className="flex items-center gap-3 text-[10px] font-mono">
            <span className={`font-bold w-14 shrink-0 ${cfg.color}`}>{cfg.label}</span>
            <span className="text-slate-600">{fmtDateTime(run.started_at)}</span>
            <span className="text-slate-700">{fmtDuration(run.duration_ms)}</span>
            <span className="text-slate-700 capitalize">{run.triggered_by}</span>
            {run.error && <span className="text-red-500 truncate max-w-[200px]">{run.error}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Workflow Card ─────────────────────────────────────────────────────────────

function WorkflowCard({
  wf,
  onToggle,
  onTrigger,
  onDelete,
}: {
  wf: WorkflowDefinition;
  onToggle: (id: string, next: WorkflowStatus) => void;
  onTrigger: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [isPending, startTransition] = useTransition();

  const statusCfg = STATUS_CONFIG[wf.status];
  const triggerCfg = TRIGGER_CONFIG[wf.trigger_type];

  async function handleToggle() {
    if (wf.status === 'draft') return; // draft uses Activate button
    setToggling(true);
    const next: WorkflowStatus = wf.status === 'active' ? 'paused' : 'active';
    const res = await apiJson('toggle_status', { id: wf.id });
    if (!res.error) onToggle(wf.id, next);
    setToggling(false);
  }

  async function handleActivateDraft() {
    setToggling(true);
    const res = await apiJson('toggle_status', { id: wf.id });
    if (!res.error) onToggle(wf.id, 'active');
    setToggling(false);
  }

  async function handleTrigger() {
    setTriggering(true);
    await onTrigger(wf.id);
    setTriggering(false);
  }

  function handleDelete() {
    startTransition(async () => {
      await apiJson('delete_workflow', { id: wf.id });
      onDelete(wf.id);
    });
  }

  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden transition-colors ${wf.status === 'active' ? 'border-slate-700' : 'border-slate-200 dark:border-slate-800'}`}>
      {/* Header row */}
      <div className="px-5 py-4 flex items-start gap-4">
        {/* Status dot */}
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusCfg.dot} ${wf.status === 'active' ? 'animate-pulse' : ''}`} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{wf.name}</h3>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${triggerCfg.color}`}>
              {triggerCfg.label}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${statusCfg.badge}`}>
              {statusCfg.label}
            </span>
          </div>
          {wf.description && (
            <p className="text-xs text-slate-500 leading-relaxed mb-2">{wf.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-[10px] font-mono text-slate-600">
            <span>{wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''}</span>
            <span>Runs: {wf.run_count}</span>
            <span>Last run: {fmtDate(wf.last_run_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Toggle or Activate */}
          {wf.status === 'draft' ? (
            <button
              type="button"
              onClick={handleActivateDraft}
              disabled={toggling}
              className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-emerald-700 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
            >
              {toggling ? '…' : 'Activate'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggle}
              disabled={toggling}
              className={`px-3 py-1.5 text-[11px] font-mono rounded-lg border transition-colors disabled:opacity-40 ${
                wf.status === 'active'
                  ? 'border-amber-700 text-amber-400 hover:bg-amber-500/10'
                  : 'border-emerald-700 text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {toggling ? '…' : wf.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          )}

          {/* Run Now */}
          <button
            type="button"
            onClick={handleTrigger}
            disabled={triggering}
            className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-indigo-700 text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-40"
          >
            {triggering ? 'Running…' : '▶ Run Now'}
          </button>

          {/* Expand steps */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {expanded ? 'Steps ▲' : 'Steps ▼'}
          </button>

          {/* History */}
          {(wf.recent_runs?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(v => !v)}
              className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {historyOpen ? 'Runs ▲' : 'Runs ▼'}
            </button>
          )}

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="px-2 py-1.5 text-[11px] font-mono rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
          >
            ×
          </button>
        </div>
      </div>

      {/* Steps panel */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-slate-200 dark:border-slate-800/60 pt-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Execution Pipeline</p>
          <StepsPipeline steps={wf.steps} />
        </div>
      )}

      {/* Run history panel */}
      {historyOpen && wf.recent_runs && wf.recent_runs.length > 0 && (
        <div className="px-5 pb-4 border-t border-slate-200 dark:border-slate-800/60 pt-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Recent Runs</p>
          <RunHistory runs={wf.recent_runs} />
        </div>
      )}
    </div>
  );
}

// ── New Workflow Modal ────────────────────────────────────────────────────────

function NewWorkflowModal({ onCreated }: { onCreated: (wf: WorkflowDefinition) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    trigger_type: 'manual' as TriggerType,
    status: 'draft' as WorkflowStatus,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.name) { setError('Name is required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await apiJson('create_workflow', form);
      if (res.error) { setError(res.error); return; }
      if (res.data) onCreated(res.data as WorkflowDefinition);
      setOpen(false);
      setForm({ name: '', description: '', trigger_type: 'manual', status: 'draft' });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors"
      >
        + New Workflow
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">New Workflow</h3>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-lg">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Name *</label>
                <input value={form.name} onChange={e => field('name', e.target.value)} placeholder="Workflow name" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="What does this workflow do?" className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Trigger Type</label>
                  <select value={form.trigger_type} onChange={e => field('trigger_type', e.target.value as TriggerType)} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/60">
                    {TRIGGER_TYPES.map(t => (
                      <option key={t} value={t}>{TRIGGER_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Initial Status</label>
                  <select value={form.status} onChange={e => field('status', e.target.value as WorkflowStatus)} className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/60">
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              </div>

              <p className="text-[10px] font-mono text-slate-600">Steps are managed via DB — you can add them after creation.</p>

              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button type="button" onClick={submit} disabled={isPending} className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40">
                {isPending ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Workflow Visualiser ───────────────────────────────────────────────────────

const VIS_W = 900;
const VIS_PAD_T = 56;
const VIS_PAD_B = 52;

const TRIG_X = 0;   const TRIG_W = 150; const TRIG_OUT = TRIG_X + TRIG_W;
const WF_X = 256;   const WF_W = 222;   const WF_OUT   = WF_X + WF_W;
const SVC_X = 580;  const SVC_W = 158;
const TRIG_H = 60;  const WF_H = 76;    const SVC_H = 60;

const VIS_TRIG_DEFS = [
  { id: 'user_event', label: 'User Event',  sub: 'signup · session',  color: '#3b82f6' },
  { id: 'schedule',   label: 'Scheduler',   sub: 'cron · daily',      color: '#f59e0b' },
  { id: 'webhook',    label: 'Webhook',     sub: 'Stripe · external', color: '#a855f7' },
  { id: 'manual',     label: 'Manual',      sub: 'admin triggered',   color: '#64748b' },
];

const VIS_SVC_DEFS = [
  { id: 'email',   label: 'Email',     sub: 'Resend API',     color: '#6366f1' },
  { id: 'db',      label: 'Database',  sub: 'Supabase',       color: '#10b981' },
  { id: 'stripe',  label: 'Billing',   sub: 'Stripe API',     color: '#8b5cf6' },
  { id: 'tickets', label: 'Tickets',   sub: 'Support queue',  color: '#f59e0b' },
  { id: 'admin',   label: 'Alerts',    sub: 'Admin notif.',   color: '#ef4444' },
];

function svcIdForAction(action: string): string | null {
  if (/send_email|welcome|check_in|milestone|re_engage|upgrade|payment_fail|founding|nudge|broadcast/i.test(action)) return 'email';
  if (/retry_payment/i.test(action)) return 'stripe';
  if (/create_ticket/i.test(action)) return 'tickets';
  if (/send_admin_alert/i.test(action)) return 'admin';
  if (/identify|query|wait/i.test(action)) return 'db';
  return null;
}

function cubicPath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

function spreadY(count: number, canvasH: number, nodeH: number): number[] {
  const usable = canvasH - VIS_PAD_T - VIS_PAD_B;
  const slot = usable / count;
  return Array.from({ length: count }, (_, i) =>
    VIS_PAD_T + i * slot + (slot - nodeH) / 2,
  );
}

interface VisConn { id: string; d: string; color: string; active: boolean; draft: boolean }

function WorkflowVisualiser({ workflows }: { workflows: WorkflowDefinition[] }) {
  const nWf     = Math.max(workflows.length, 1);
  const canvasH = Math.max(640, Math.max(nWf, VIS_SVC_DEFS.length) * 112 + VIS_PAD_T + VIS_PAD_B);

  const trigYs = spreadY(VIS_TRIG_DEFS.length, canvasH, TRIG_H);
  const wfYs   = spreadY(nWf,                  canvasH, WF_H);
  const svcYs  = spreadY(VIS_SVC_DEFS.length,  canvasH, SVC_H);

  const conns: VisConn[] = [];
  workflows.forEach((wf, wi) => {
    const wCY    = wfYs[wi] + WF_H / 2;
    const tIdx   = Math.max(0, VIS_TRIG_DEFS.findIndex(t => t.id === wf.trigger_type));
    const tCY    = trigYs[tIdx] + TRIG_H / 2;
    const active = wf.status === 'active';
    const draft  = wf.status === 'draft';

    conns.push({ id: `vt${wi}`, d: cubicPath(TRIG_OUT, tCY, WF_X, wCY), color: VIS_TRIG_DEFS[tIdx].color, active, draft });

    const seen = new Set<string>();
    wf.steps.forEach(step => {
      const sid = svcIdForAction(step.action);
      if (!sid || seen.has(sid)) return;
      seen.add(sid);
      const si = VIS_SVC_DEFS.findIndex(s => s.id === sid);
      if (si < 0) return;
      conns.push({ id: `vs${wi}_${sid}`, d: cubicPath(WF_OUT, wCY, SVC_X, svcYs[si] + SVC_H / 2), color: VIS_SVC_DEFS[si].color, active, draft });
    });
  });

  return (
    <div className="overflow-x-auto rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 select-none">
      <div style={{ width: VIS_W, height: canvasH, position: 'relative' }}>

        {/* Column headers */}
        {([
          { label: 'TRIGGERS',       cx: TRIG_X + TRIG_W / 2 },
          { label: 'WORKFLOWS',      cx: WF_X + WF_W / 2 },
          { label: 'INFRASTRUCTURE', cx: SVC_X + SVC_W / 2 },
        ] as const).map(h => (
          <div key={h.label}
            style={{ position: 'absolute', left: h.cx, top: 14, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
            className="text-[9px] font-mono font-bold text-slate-700 uppercase tracking-widest">
            {h.label}
          </div>
        ))}

        {/* SVG: grid, dividers, paths, particles */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <pattern id="vg-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.7" fill="#1a2535" />
            </pattern>
            <filter id="vg-glow">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="url(#vg-dots)" />

          {/* Column dividers */}
          {[TRIG_OUT + 52, WF_OUT + 50].map((x, i) => (
            <line key={i} x1={x} y1={VIS_PAD_T} x2={x} y2={canvasH - VIS_PAD_B}
              stroke="#1e293b" strokeWidth="1" strokeDasharray="4 8" />
          ))}

          {/* Connections */}
          {conns.map(c => (
            <g key={c.id}>
              <path
                id={c.id} d={c.d} fill="none"
                stroke={c.active ? c.color : c.draft ? '#111e2e' : '#1e2d3d'}
                strokeWidth={c.active ? 1.5 : 1}
                strokeDasharray={c.draft ? '5 7' : undefined}
                opacity={c.active ? 0.85 : c.draft ? 0.22 : 0.4}
                filter={c.active ? 'url(#vg-glow)' : undefined}
              />
              {c.active && [0, 1, 2].map(i => (
                <circle key={i} r={3} fill={c.color} opacity={0.9}>
                  <animateMotion dur="3s" begin={`${-i}s`} repeatCount="indefinite">
                    <mpath href={`#${c.id}`} />
                  </animateMotion>
                </circle>
              ))}
            </g>
          ))}
        </svg>

        {/* Trigger nodes */}
        {VIS_TRIG_DEFS.map((tr, i) => {
          const active = workflows.some(w => w.trigger_type === tr.id && w.status === 'active');
          const used   = workflows.some(w => w.trigger_type === tr.id);
          return (
            <div key={tr.id} style={{ position: 'absolute', left: TRIG_X + 4, top: trigYs[i], width: TRIG_W - 8, height: TRIG_H, opacity: used ? 1 : 0.28 }}>
              <div style={{ height: '100%', borderRadius: 10, padding: '9px 12px', boxSizing: 'border-box', border: `1px solid ${active ? tr.color : '#1e3347'}`, background: active ? `${tr.color}18` : '#0d1b2a' }}>
                <p style={{ color: active ? tr.color : '#475569', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, margin: 0 }}>{tr.label}</p>
                <p style={{ color: '#2d4057', fontSize: 9, fontFamily: 'monospace', margin: '3px 0 0' }}>{tr.sub}</p>
                {active && <span className="block w-1.5 h-1.5 rounded-full animate-pulse mt-1.5" style={{ background: tr.color }} />}
              </div>
            </div>
          );
        })}

        {/* Workflow nodes */}
        {workflows.map((wf, i) => {
          const active  = wf.status === 'active';
          const paused  = wf.status === 'paused';
          const bc      = active ? '#10b981' : paused ? '#f59e0b' : '#1a2a3a';
          const services = [...new Set(wf.steps.map(s => svcIdForAction(s.action)).filter(Boolean))] as string[];
          return (
            <div key={wf.id} style={{ position: 'absolute', left: WF_X + 4, top: wfYs[i], width: WF_W - 8, height: WF_H, opacity: wf.status === 'draft' ? 0.42 : 1 }}>
              <div style={{ height: '100%', borderRadius: 10, padding: '9px 12px', boxSizing: 'border-box', border: `1px solid ${bc}`, background: active ? 'rgba(16,185,129,0.07)' : '#0d1b2a' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'animate-pulse' : ''}`} style={{ background: bc }} />
                  <p style={{ color: active ? '#f1f5f9' : '#64748b', fontSize: 10, fontFamily: 'monospace', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{wf.name}</p>
                </div>
                <p style={{ color: '#2d4057', fontSize: 9, fontFamily: 'monospace', margin: '0 0 5px 18px' }}>{wf.steps.length} steps · {wf.run_count} runs</p>
                {services.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, marginLeft: 18, flexWrap: 'wrap' }}>
                    {services.slice(0, 3).map(sid => {
                      const svc = VIS_SVC_DEFS.find(s => s.id === sid)!;
                      return (
                        <span key={sid} style={{ fontSize: 8, fontFamily: 'monospace', color: svc.color, background: `${svc.color}18`, border: `1px solid ${svc.color}40`, borderRadius: 4, padding: '1px 5px' }}>
                          {svc.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Service nodes */}
        {VIS_SVC_DEFS.map((svc, i) => {
          const active = workflows.some(w => w.status === 'active' && w.steps.some(s => svcIdForAction(s.action) === svc.id));
          const used   = workflows.some(w => w.steps.some(s => svcIdForAction(s.action) === svc.id));
          return (
            <div key={svc.id} style={{ position: 'absolute', left: SVC_X + 4, top: svcYs[i], width: SVC_W - 8, height: SVC_H, opacity: used ? 1 : 0.26 }}>
              <div style={{ height: '100%', borderRadius: 10, padding: '9px 12px', boxSizing: 'border-box', border: `1px solid ${active ? svc.color : '#1e3347'}`, background: active ? `${svc.color}18` : '#0d1b2a' }}>
                <p style={{ color: active ? svc.color : '#475569', fontSize: 11, fontFamily: 'monospace', fontWeight: 700, margin: 0 }}>{svc.label}</p>
                <p style={{ color: '#2d4057', fontSize: 9, fontFamily: 'monospace', margin: '3px 0 0' }}>{svc.sub}</p>
                {active && <span className="block w-1.5 h-1.5 rounded-full animate-pulse mt-1.5" style={{ background: svc.color }} />}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 14, left: WF_X + 4, display: 'flex', gap: 20, alignItems: 'center' }}>
          {[
            { color: '#10b981', label: 'Active', dash: false },
            { color: '#f59e0b', label: 'Paused', dash: false },
            { color: '#334155', label: 'Draft',  dash: true },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="22" height="2"><line x1="0" y1="1" x2="22" y2="1" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash ? '4 4' : undefined} /></svg>
              <span style={{ color: '#475569', fontSize: 9, fontFamily: 'monospace' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-400 inline-block" />
            <span style={{ color: '#334155', fontSize: 9, fontFamily: 'monospace' }}>live data flow</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WorkflowsClient({ initialWorkflows }: Props) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [view, setView] = useState<'cards' | 'visualiser'>('cards');

  function showToast(message: string, kind: 'success' | 'error') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2500);
  }

  function handleToggle(id: string, next: WorkflowStatus) {
    setWorkflows(prev =>
      prev.map(wf => wf.id === id ? { ...wf, status: next } : wf)
    );
    showToast(`Workflow ${next === 'active' ? 'activated' : next === 'paused' ? 'paused' : 'updated'}`, 'success');
  }

  async function handleTrigger(id: string) {
    const res = await apiJson('trigger_workflow', { id });
    if (res.error) {
      showToast(`Run failed: ${res.error}`, 'error');
      return;
    }
    const run = res.data as WorkflowRun | undefined;
    setWorkflows(prev =>
      prev.map(wf => {
        if (wf.id !== id) return wf;
        return {
          ...wf,
          run_count: wf.run_count + 1,
          last_run_at: run?.started_at ?? new Date().toISOString(),
          recent_runs: run ? [run, ...(wf.recent_runs ?? [])].slice(0, 5) : wf.recent_runs,
        };
      })
    );
    showToast('Workflow executed successfully', 'success');
  }

  function handleDelete(id: string) {
    setWorkflows(prev => prev.filter(wf => wf.id !== id));
    showToast('Workflow deleted', 'success');
  }

  function handleCreated(wf: WorkflowDefinition) {
    setWorkflows(prev => [{ ...wf, recent_runs: [] }, ...prev]);
    showToast('Workflow created', 'success');
  }

  const statusCounts = workflows.reduce<Record<string, number>>((acc, wf) => {
    acc[wf.status] = (acc[wf.status] ?? 0) + 1;
    return acc;
  }, {});

  const filtered = statusFilter === 'all'
    ? workflows
    : workflows.filter(wf => wf.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">

        {/* View toggle */}
        <div className="flex gap-0.5 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-700/60 rounded-lg p-0.5">
          {(['cards', 'visualiser'] as const).map(v => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-mono rounded-md transition-colors capitalize ${view === v ? 'bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {v === 'visualiser' ? '⬡ Visualiser' : '☰ Cards'}
            </button>
          ))}
        </div>

        {/* Status filters + create — cards view only */}
        {view === 'cards' && (
          <>
            <div className="flex gap-1">
              <button type="button" onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-indigo-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                All ({workflows.length})
              </button>
              {(['active', 'paused', 'draft'] as WorkflowStatus[]).map(s =>
                statusCounts[s] ? (
                  <button key={s} type="button" onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${statusFilter === s ? 'bg-indigo-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                    {STATUS_CONFIG[s].label} ({statusCounts[s]})
                  </button>
                ) : null
              )}
            </div>
            <div className="ml-auto">
              <NewWorkflowModal onCreated={handleCreated} />
            </div>
          </>
        )}
      </div>

      {/* Visualiser */}
      {view === 'visualiser' && <WorkflowVisualiser workflows={workflows} />}

      {/* Cards */}
      {view === 'cards' && (
        filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-600 font-mono">No workflows — create one above</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(wf => (
              <WorkflowCard key={wf.id} wf={wf} onToggle={handleToggle} onTrigger={handleTrigger} onDelete={handleDelete} />
            ))}
          </div>
        )
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
