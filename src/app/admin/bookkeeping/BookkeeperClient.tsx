'use client';

import { useState, useEffect, useCallback } from 'react';

interface Draft {
  id: string;
  draft_type: 'stripe_sync' | 'categorize' | 'vat_reconciliation' | 'expense_from_email';
  status: string;
  title: string;
  summary: string | null;
  proposed_payload: Record<string, unknown>;
  confidence_pct: number | null;
  created_at: string;
}

const TYPE_LABEL: Record<Draft['draft_type'], string> = {
  stripe_sync: 'Stripe → Xero',
  categorize: 'Categorise transaction',
  vat_reconciliation: 'VAT / intercompany',
  expense_from_email: 'Expense from email',
};

// Fields the drafting crons may leave blank because they're Xero-organisation-
// specific (a chart-of-accounts code) — editable here before approval, same
// as editing subject/body on an email draft.
const EDITABLE_FIELDS = new Set(['accountCode', 'bankAccountCode']);

function formatVal(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('en-GB');
  return String(v);
}

export function BookkeeperClient() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Draft['draft_type']>('all');
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/xero/status').then(r => r.json()),
      fetch(`/api/admin/bookkeeping/drafts${filter !== 'all' ? `?draft_type=${filter}` : ''}`).then(r => r.json()),
    ])
      .then(([status, draftsRes]: [{ connected: boolean; tenantName: string | null }, { drafts: Draft[] }]) => {
        setConnected(status.connected);
        setTenantName(status.tenantName);
        setDrafts(draftsRes.drafts ?? []);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function setEdit(draftId: string, field: string, value: string) {
    setEdits(prev => ({ ...prev, [draftId]: { ...prev[draftId], [field]: value } }));
  }

  async function act(draft: Draft, action: 'approve' | 'reject') {
    setBusyId(draft.id);
    try {
      const payload = edits[draft.id];
      const res = await fetch('/api/admin/bookkeeping/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, action, ...(payload ? { payload } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? `Failed to ${action}`);
        return;
      }
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bookkeeping</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          AI-proposed Xero actions — Stripe payment sync, bank transaction categorisation, VAT/intercompany
          reconciliation, and expenses captured from vendor email. Nothing here writes to Xero until you approve it.
        </p>
      </div>

      {connected === false && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Xero isn&apos;t connected yet — the sync crons will keep skipping until it is.
          </p>
          <a
            href="/api/admin/xero/connect"
            className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            Connect Xero
          </a>
        </div>
      )}
      {connected === true && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            Connected to <b>{tenantName ?? 'your Xero organisation'}</b>.
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['all', 'stripe_sync', 'categorize', 'vat_reconciliation', 'expense_from_email'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              filter === t
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
          >
            {t === 'all' ? 'All' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-slate-400">No pending drafts.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map(draft => (
            <div key={draft.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{TYPE_LABEL[draft.draft_type]}</span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{draft.title}</p>
                  {draft.summary && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{draft.summary}</p>}
                </div>
                {draft.confidence_pct != null && (
                  <span className="flex-shrink-0 text-[10px] font-semibold text-slate-400">{draft.confidence_pct}% confidence</span>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 mb-4 text-xs">
                {Object.entries(draft.proposed_payload).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-slate-400">{key}</p>
                    {EDITABLE_FIELDS.has(key) ? (
                      <input
                        type="text"
                        defaultValue={formatVal(value) === '—' ? '' : String(value)}
                        placeholder="required before approving"
                        onChange={e => setEdit(draft.id, key, e.target.value)}
                        className="mt-0.5 w-full text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white"
                      />
                    ) : (
                      <p className="font-medium text-slate-700 dark:text-slate-300">{formatVal(value)}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  disabled={busyId === draft.id}
                  onClick={() => act(draft, 'reject')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  disabled={busyId === draft.id || connected === false}
                  onClick={() => act(draft, 'approve')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === draft.id ? 'Applying…' : 'Approve'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
