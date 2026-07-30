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
  manual:     { label: 'Manual',      color: 'bg-slate-700 text-slate-300' },
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
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 min-w-[120px]">
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
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden transition-colors ${wf.status === 'active' ? 'border-slate-700' : 'border-slate-800'}`}>
      {/* Header row */}
      <div className="px-5 py-4 flex items-start gap-4">
        {/* Status dot */}
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${statusCfg.dot} ${wf.status === 'active' ? 'animate-pulse' : ''}`} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white">{wf.name}</h3>
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
            className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? 'Steps ▲' : 'Steps ▼'}
          </button>

          {/* History */}
          {(wf.recent_runs?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen(v => !v)}
              className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              {historyOpen ? 'Runs ▲' : 'Runs ▼'}
            </button>
          )}

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="px-2 py-1.5 text-[11px] font-mono rounded-lg border border-slate-800 text-slate-700 hover:text-red-400 hover:border-red-800/50 transition-colors disabled:opacity-40"
          >
            ×
          </button>
        </div>
      </div>

      {/* Steps panel */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-slate-800/60 pt-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Execution Pipeline</p>
          <StepsPipeline steps={wf.steps} />
        </div>
      )}

      {/* Run history panel */}
      {historyOpen && wf.recent_runs && wf.recent_runs.length > 0 && (
        <div className="px-5 pb-4 border-t border-slate-800/60 pt-3">
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
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        + New Workflow
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">New Workflow</h3>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Name *</label>
                <input value={form.name} onChange={e => field('name', e.target.value)} placeholder="Workflow name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={2} placeholder="What does this workflow do?" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Trigger Type</label>
                  <select value={form.trigger_type} onChange={e => field('trigger_type', e.target.value as TriggerType)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                    {TRIGGER_TYPES.map(t => (
                      <option key={t} value={t}>{TRIGGER_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Initial Status</label>
                  <select value={form.status} onChange={e => field('status', e.target.value as WorkflowStatus)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              </div>

              <p className="text-[10px] font-mono text-slate-600">Steps are managed via DB — you can add them after creation.</p>

              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={submit} disabled={isPending} className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                {isPending ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => { setOpen(false); setError(null); }} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function WorkflowsClient({ initialWorkflows }: Props) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');

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
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            All ({workflows.length})
          </button>
          {(['active', 'paused', 'draft'] as WorkflowStatus[]).map(s => (
            statusCounts[s] ? (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                {STATUS_CONFIG[s].label} ({statusCounts[s]})
              </button>
            ) : null
          ))}
        </div>
        <div className="ml-auto">
          <NewWorkflowModal onCreated={handleCreated} />
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-600 font-mono">No workflows — create one above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(wf => (
            <WorkflowCard
              key={wf.id}
              wf={wf}
              onToggle={handleToggle}
              onTrigger={handleTrigger}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}
