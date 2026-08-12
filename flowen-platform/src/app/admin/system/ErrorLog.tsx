'use client';

import React, { useState } from 'react';

interface ErrorEntry {
  id: string;
  source: string;
  error_code: string | null;
  message: string;
  stack_trace: string | null;
  environment: string;
  resolved: boolean;
  timestamp: string;
  metadata: Record<string, unknown> | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function ErrorRow({ entry, onUpdate }: { entry: ErrorEntry; onUpdate: (id: string, resolved: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  async function act(action: 'resolve_error' | 'delete_error') {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, errorId: entry.id }),
      });
      if (res.ok) onUpdate(entry.id, action === 'resolve_error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`border-b border-slate-200 dark:border-slate-800 last:border-0 ${entry.resolved ? 'opacity-50' : ''}`}>
      <div className="px-5 py-4 flex items-start gap-4">
        {/* Dot */}
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${entry.resolved ? 'bg-slate-600' : 'bg-red-400 animate-pulse'}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-mono text-slate-500">{entry.source}</span>
            {entry.error_code && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                {entry.error_code}
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${entry.environment === 'production' ? 'bg-red-500/10 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
              {entry.environment}
            </span>
            <span className="text-[10px] text-slate-600 font-mono ml-auto">{fmtDate(entry.timestamp)}</span>
          </div>
          <p className="text-xs text-slate-900 dark:text-white font-medium leading-relaxed">{entry.message}</p>

          {/* Stack trace toggle */}
          {entry.stack_trace && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 font-mono transition-colors"
            >
              {expanded ? '▲ hide stack' : '▼ show stack'}
            </button>
          )}
          {expanded && entry.stack_trace && (
            <pre className="mt-2 text-[10px] text-slate-400 font-mono bg-slate-50 dark:bg-slate-950 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
              {entry.stack_trace.slice(0, 3000)}
            </pre>
          )}

          {/* Metadata preview */}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(entry.metadata).filter(([, v]) => v != null).slice(0, 4).map(([k, v]) => (
                <span key={k} className="text-[9px] font-mono text-slate-600">
                  {k}: <span className="text-slate-500">{String(v).slice(0, 60)}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!entry.resolved && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => act('resolve_error')}
              disabled={loading}
              className="px-2.5 py-1.5 text-[10px] font-mono rounded-lg border border-emerald-700/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
            >
              Resolve
            </button>
            <button
              type="button"
              onClick={() => act('delete_error')}
              disabled={loading}
              className="px-2.5 py-1.5 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-700/50 transition-colors disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorLogList({ initialErrors }: { initialErrors: ErrorEntry[] }) {
  const [errors, setErrors] = useState(initialErrors);

  function handleUpdate(id: string, resolved: boolean) {
    if (!resolved) {
      setErrors(prev => prev.filter(e => e.id !== id));
    } else {
      setErrors(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
    }
  }

  const unresolved = errors.filter(e => !e.resolved);
  const resolved   = errors.filter(e => e.resolved);

  if (errors.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-emerald-400 font-mono">No errors — system clean</p>
    );
  }

  return (
    <div>
      {unresolved.length > 0 && (
        <div>
          {unresolved.map(e => <ErrorRow key={e.id} entry={e} onUpdate={handleUpdate} />)}
        </div>
      )}
      {resolved.length > 0 && (
        <details>
          <summary className="px-5 py-3 text-[10px] font-mono text-slate-600 cursor-pointer hover:text-slate-400 transition-colors border-t border-slate-200 dark:border-slate-800">
            {resolved.length} resolved error{resolved.length !== 1 ? 's' : ''} (click to show)
          </summary>
          {resolved.map(e => <ErrorRow key={e.id} entry={e} onUpdate={handleUpdate} />)}
        </details>
      )}
    </div>
  );
}
