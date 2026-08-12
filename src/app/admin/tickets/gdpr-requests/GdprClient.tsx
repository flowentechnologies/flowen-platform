'use client';

import React, { useState, useTransition } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type GdprRequestType   = 'access' | 'erasure' | 'portability' | 'rectification' | 'restriction';
type GdprRequestStatus = 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'rejected';

interface GdprRequest {
  id: string;
  user_id: string | null;
  user_email: string;
  user_name: string | null;
  request_type: GdprRequestType;
  status: GdprRequestStatus;
  details: string | null;
  internal_notes: string | null;
  sla_due_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Props {
  initialRequests: GdprRequest[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<GdprRequestType, { label: string; article: string; color: string }> = {
  access:        { label: 'Access',        article: 'Art. 15', color: 'bg-blue-500/10 text-blue-400' },
  erasure:       { label: 'Erasure',       article: 'Art. 17', color: 'bg-red-500/10 text-red-400' },
  portability:   { label: 'Portability',   article: 'Art. 20', color: 'bg-purple-500/10 text-purple-400' },
  rectification: { label: 'Rectification', article: 'Art. 16', color: 'bg-amber-500/10 text-amber-400' },
  restriction:   { label: 'Restriction',   article: 'Art. 18', color: 'bg-orange-500/10 text-orange-400' },
};

const STATUS_CONFIG: Record<GdprRequestStatus, { label: string; color: string }> = {
  pending:      { label: 'Pending',      color: 'bg-amber-500/10 text-amber-400' },
  acknowledged: { label: 'Acknowledged', color: 'bg-blue-500/10 text-blue-400' },
  in_progress:  { label: 'In Progress',  color: 'bg-indigo-500/10 text-indigo-400' },
  completed:    { label: 'Completed',    color: 'bg-emerald-500/10 text-emerald-400' },
  rejected:     { label: 'Rejected',     color: 'bg-slate-700 text-slate-400' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  return days;
}

async function api(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/tickets/gdpr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── Create request modal ──────────────────────────────────────────────────────

function CreateRequestModal({ onCreated }: { onCreated: (r: GdprRequest) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_email: '', user_name: '', user_id: '', request_type: 'access' as GdprRequestType, details: '' });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.user_email || !form.request_type) { setError('Email and request type are required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await api('create_request', form);
      if (res.error) { setError(res.error); return; }
      onCreated(res.data);
      setOpen(false);
      setForm({ user_email: '', user_name: '', user_id: '', request_type: 'access', details: '' });
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors">
        + Log Request
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Log GDPR Request</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">User Email *</label>
                  <input value={form.user_email} onChange={e => field('user_email', e.target.value)} placeholder="user@example.com"
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Name</label>
                  <input value={form.user_name} onChange={e => field('user_name', e.target.value)} placeholder="Full name"
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Request Type *</label>
                <select value={form.request_type} onChange={e => field('request_type', e.target.value as GdprRequestType)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/60">
                  {(Object.entries(TYPE_CONFIG) as [GdprRequestType, { label: string; article: string }][]).map(([v, c]) => (
                    <option key={v} value={v}>{c.label} ({c.article})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">User ID (if known)</label>
                <input value={form.user_id} onChange={e => field('user_id', e.target.value)} placeholder="UUID from auth.users"
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 font-mono text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Details</label>
                <textarea value={form.details} onChange={e => field('details', e.target.value)} rows={3}
                  placeholder="Subject's request verbatim or summary…"
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>
              <p className="text-[11px] text-slate-600 font-mono">SLA: 30-day clock starts now (UK GDPR Art. 12(3))</p>
              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button type="button" onClick={submit} disabled={isPending}
                className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40">
                {isPending ? 'Creating…' : 'Log Request'}
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Request row ───────────────────────────────────────────────────────────────

function RequestRow({ req, onUpdate, onDelete }: {
  req: GdprRequest;
  onUpdate: (id: string, patch: Partial<GdprRequest>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [erasureConfirm, setErasureConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const typeCfg   = TYPE_CONFIG[req.request_type];
  const statusCfg = STATUS_CONFIG[req.status];
  const days      = daysLeft(req.sla_due_at);
  const overdue   = days < 0;
  const urgent    = !overdue && days <= 5;
  const done      = req.status === 'completed' || req.status === 'rejected';

  function updateStatus(status: GdprRequestStatus) {
    startTransition(async () => {
      await api('update_status', { id: req.id, status });
      const patch: Partial<GdprRequest> = { status };
      if (status === 'acknowledged') patch.acknowledged_at = new Date().toISOString();
      if (status === 'completed')    patch.completed_at    = new Date().toISOString();
      onUpdate(req.id, patch);
    });
  }

  function applyErasure() {
    if (!req.user_id) return;
    startTransition(async () => {
      const res = await api('apply_erasure', { id: req.id, user_id: req.user_id });
      if (!res.error) {
        onUpdate(req.id, { status: 'completed', completed_at: new Date().toISOString(), internal_notes: 'Erasure applied via apply_gdpr_erasure() + auth.users deleted.' });
        setErasureConfirm(false);
      }
    });
  }

  return (
    <div className={`border-b border-slate-200 dark:border-slate-800 last:border-0 ${done ? 'opacity-50' : ''}`}>
      <div className="px-5 py-4 flex items-start gap-4">
        {/* SLA indicator */}
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${overdue ? 'bg-red-400 animate-pulse' : urgent ? 'bg-amber-400' : done ? 'bg-emerald-500' : 'bg-slate-500'}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${typeCfg.color}`}>
              {typeCfg.label}
            </span>
            <span className="text-[10px] font-mono text-slate-600">{typeCfg.article}</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className={`text-[10px] font-mono ml-auto ${overdue ? 'text-red-400 font-bold' : urgent ? 'text-amber-400' : 'text-slate-600'}`}>
              {done ? `Completed ${req.completed_at ? fmtDate(req.completed_at) : ''}` : overdue ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {req.user_name ?? req.user_email}
            {req.user_name && <span className="text-slate-500 font-normal text-xs ml-1.5">({req.user_email})</span>}
          </p>
          <p className="text-[10px] text-slate-600 font-mono mt-0.5">Received {fmtDate(req.created_at)} · SLA deadline {fmtDate(req.sla_due_at)}</p>

          {req.details && (
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{req.details}</p>
          )}

          {/* Expand for actions */}
          {!done && (
            <button type="button" onClick={() => setExpanded(v => !v)}
              className="mt-2 text-[10px] text-slate-600 hover:text-slate-300 font-mono transition-colors">
              {expanded ? '▲ hide actions' : '▼ manage'}
            </button>
          )}

          {expanded && !done && (
            <div className="mt-3 space-y-3">
              {/* Status controls */}
              <div className="flex flex-wrap gap-2">
                {req.status === 'pending' && (
                  <button type="button" onClick={() => updateStatus('acknowledged')} disabled={isPending}
                    className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-blue-700/50 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40">
                    Acknowledge
                  </button>
                )}
                {(req.status === 'pending' || req.status === 'acknowledged') && (
                  <button type="button" onClick={() => updateStatus('in_progress')} disabled={isPending}
                    className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-indigo-700/50 text-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-40">
                    Mark In Progress
                  </button>
                )}
                <button type="button" onClick={() => updateStatus('completed')} disabled={isPending}
                  className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-emerald-700/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40">
                  Mark Complete
                </button>
                <button type="button" onClick={() => updateStatus('rejected')} disabled={isPending}
                  className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-700/50 transition-colors disabled:opacity-40">
                  Reject
                </button>
              </div>

              {/* Erasure action */}
              {req.request_type === 'erasure' && req.user_id && (
                <div>
                  {erasureConfirm ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                      <p className="text-xs text-red-300 font-mono font-bold">⚠ IRREVERSIBLE: This will delete all personal data and remove the account from auth.users</p>
                      <p className="text-[11px] text-slate-400 font-mono">User: {req.user_email} · ID: {req.user_id}</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={applyErasure} disabled={isPending}
                          className="px-4 py-2 text-xs font-mono font-bold rounded-lg bg-red-600 hover:bg-red-500 text-slate-900 dark:text-white transition-colors disabled:opacity-40">
                          {isPending ? 'Applying…' : 'Confirm Erasure'}
                        </button>
                        <button type="button" onClick={() => setErasureConfirm(false)}
                          className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setErasureConfirm(true)}
                      className="px-3 py-1.5 text-[11px] font-mono rounded-lg border border-red-700/50 text-red-400 hover:bg-red-500/10 transition-colors">
                      Apply Erasure (Art. 17)
                    </button>
                  )}
                </div>
              )}

              {req.request_type === 'erasure' && !req.user_id && (
                <p className="text-[11px] text-slate-600 font-mono">No user_id on record — locate via Users section and re-log this request with the UUID to enable automated erasure.</p>
              )}
            </div>
          )}

          {req.internal_notes && (
            <p className="mt-2 text-[11px] text-amber-400/70 font-mono">📝 {req.internal_notes}</p>
          )}
        </div>

        {/* Delete */}
        {done && (
          <button type="button" onClick={() => onDelete(req.id)} disabled={isPending}
            className="shrink-0 text-slate-700 hover:text-red-400 transition-colors text-sm disabled:opacity-40">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function GdprClient({ initialRequests }: Props) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<GdprRequestStatus | 'all'>('all');

  function handleUpdate(id: string, patch: Partial<GdprRequest>) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function handleDelete(id: string) {
    setRequests(prev => prev.filter(r => r.id !== id));
  }

  function handleCreated(r: GdprRequest) { setRequests(prev => [r, ...prev]); }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pending   = requests.filter(r => r.status === 'pending').length;
  const overdue   = requests.filter(r => !['completed','rejected'].includes(r.status) && daysLeft(r.sla_due_at) < 0).length;

  return (
    <div className="space-y-4">
      {overdue > 0 && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
          <p className="text-sm text-red-400 font-mono">
            <span className="font-bold">{overdue}</span> request{overdue !== 1 ? 's' : ''} have breached the 30-day UK GDPR SLA
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {(['all', 'pending', 'acknowledged', 'in_progress', 'completed', 'rejected'] as const).map(s => {
            const count = s === 'all' ? requests.length : requests.filter(r => r.status === s).length;
            if (count === 0 && s !== 'all' && s !== 'pending') return null;
            return (
              <button key={s} type="button" onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${filter === s ? 'bg-indigo-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label} ({count})
              </button>
            );
          })}
        </div>
        <CreateRequestModal onCreated={handleCreated} />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">No {filter === 'all' ? '' : filter} requests</p>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {filtered.map(r => (
            <RequestRow key={r.id} req={r} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {pending === 0 && requests.length > 0 && (
        <p className="text-xs text-emerald-400 font-mono text-center">All requests acknowledged ✓</p>
      )}
    </div>
  );
}
