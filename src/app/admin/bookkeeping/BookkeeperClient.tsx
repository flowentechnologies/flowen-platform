'use client';

import { useState, useEffect, useCallback } from 'react';

interface Draft {
  id: string;
  draft_type: 'stripe_sync' | 'categorize' | 'vat_reconciliation' | 'expense_from_email' | 'dla_journal';
  status: string;
  entity: string;
  title: string;
  summary: string | null;
  proposed_payload: Record<string, unknown>;
  confidence_pct: number | null;
  created_at: string;
}

interface EntityStatus {
  slug: string;
  name: string;
  connected: boolean;
  tenantName: string | null;
}

const TYPE_LABEL: Record<Draft['draft_type'], string> = {
  stripe_sync: 'Stripe → Xero',
  categorize: 'Categorise transaction',
  vat_reconciliation: 'VAT / intercompany',
  expense_from_email: 'Expense from email',
  dla_journal: 'DLA journal',
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
  const [entities, setEntities] = useState<EntityStatus[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Draft['draft_type']>('all');
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disconnectingEntity, setDisconnectingEntity] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/xero/status').then(r => r.json()),
      fetch(`/api/admin/bookkeeping/drafts${filter !== 'all' ? `?draft_type=${filter}` : ''}`).then(r => r.json()),
    ])
      .then(([status, draftsRes]: [{ entities: EntityStatus[] }, { drafts: Draft[] }]) => {
        setEntities(status.entities);
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

  async function disconnect(slug: string, name: string) {
    if (!confirm(`Disconnect ${name} from Xero? You'll need to reconnect it via Connect before it syncs again.`)) return;
    setDisconnectingEntity(slug);
    try {
      const res = await fetch('/api/admin/xero/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity: slug }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? 'Failed to disconnect');
        return;
      }
      load();
    } finally {
      setDisconnectingEntity(null);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    try {
      const res = await fetch('/api/admin/bookkeeping/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) { setAskError(data.error ?? 'Failed to get an answer'); return; }
      setAnswer(data.answer);
    } catch {
      setAskError('Failed to reach the server');
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bookkeeping</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            AI-proposed Xero actions — Stripe payment sync, bank transaction categorisation, VAT/intercompany
            reconciliation, and expenses captured from vendor email. Nothing here writes to Xero until you approve it.
          </p>
        </div>
        <a
          href="/admin/bookkeeping/overview"
          className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity"
        >
          Group Overview →
        </a>
      </div>

      {entities && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entities.map(e => (
            <div
              key={e.slug}
              className={`rounded-xl p-4 flex items-center justify-between gap-4 border ${
                e.connected
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.name}</p>
                <p className={`text-xs mt-0.5 ${e.connected ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {e.connected ? `Connected to ${e.tenantName ?? 'Xero'}` : "Not connected — the sync crons skip this entity until it is."}
                </p>
              </div>
              {!e.connected ? (
                <a
                  href={`/api/admin/xero/connect?entity=${e.slug}`}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                >
                  Connect
                </a>
              ) : (
                <button
                  onClick={() => disconnect(e.slug, e.name)}
                  disabled={disconnectingEntity === e.slug}
                  className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                  {disconnectingEntity === e.slug ? 'Disconnecting…' : 'Disconnect'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Ask</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !asking) ask(); }}
            placeholder="e.g. any unreconciled transactions? any duplicate bills? what's our burn this month?"
            className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
          />
          <button
            onClick={ask}
            disabled={asking || !question.trim()}
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-50"
          >
            {asking ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          Read-only — answers from live Xero data plus locally captured invoices. Never writes anything.
        </p>
        {askError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{askError}</p>}
        {answer && (
          <div className="mt-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {answer}
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'stripe_sync', 'categorize', 'vat_reconciliation', 'expense_from_email', 'dla_journal'] as const).map(t => (
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
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600 ml-2">
                    {entities?.find(e => e.slug === draft.entity)?.name ?? draft.entity}
                  </span>
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
                  disabled={busyId === draft.id || !entities?.find(e => e.slug === draft.entity)?.connected}
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
