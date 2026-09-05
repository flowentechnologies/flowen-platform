'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface InboxItem {
  id: string;
  alias: string;
  from_address: string;
  from_name: string | null;
  subject: string;
  snippet: string;
  received_at: string;
  category: string;
  gmail_category: string | null;
  is_billing: boolean;
  status: string;
  ai_drafts: { id: string; status: string; confidence_pct: number }[];
}

interface Draft {
  id: string;
  draft_type: string;
  to_address: string;
  from_alias: string;
  subject: string;
  body_text: string;
  confidence_pct: number;
  status: string;
  created_at: string;
  inbox_items: { subject: string; from_address: string; from_name: string | null; alias: string; category: string } | null;
}

const CATEGORY_COLOR: Record<string, string> = {
  general: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  billing: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  crm: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  press: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  security: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  support: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  careers: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  affiliates: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
};

// Gmail's own inbox-tab classification (Primary/Social/Promotions/Updates/
// Forums, plus Spam) — distinct from CATEGORY_COLOR above, which is this
// app's alias/vendor-driven category.
const GMAIL_CATEGORY_LABEL: Record<string, string> = {
  primary: 'Primary', social: 'Social', promotions: 'Promotions',
  updates: 'Updates', forums: 'Forums', spam: 'Spam',
};
const GMAIL_CATEGORY_ICON: Record<string, string> = {
  primary: '📥', social: '👥', promotions: '🏷️', updates: '🔔', forums: '💬', spam: '🚫',
};

function confidenceColor(pct: number): string {
  if (pct >= 85) return 'text-emerald-400';
  if (pct >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

export function InboxClient() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'inbox' | 'drafts'>(searchParams.get('tab') === 'drafts' ? 'drafts' : 'inbox');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<Record<string, { subject: string; body: string }>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [aliasFilter, setAliasFilter] = useState<string | null>(null);
  const [gmailCategoryFilter, setGmailCategoryFilter] = useState<string | null>(null);
  const [aliasCounts, setAliasCounts] = useState<Record<string, number>>({});
  const [gmailCategoryCounts, setGmailCategoryCounts] = useState<Record<string, number>>({});

  const fetchInbox = useCallback(async () => {
    const params = new URLSearchParams();
    if (aliasFilter) params.set('alias', aliasFilter);
    if (gmailCategoryFilter) params.set('gmail_category', gmailCategoryFilter);
    const res = await fetch(`/api/admin/inbox?${params.toString()}`);
    if (!res.ok) return;
    const data = await res.json() as {
      items: InboxItem[]; gmail_connected: boolean;
      alias_counts: Record<string, number>; gmail_category_counts: Record<string, number>;
    };
    setItems(data.items);
    setConnected(data.gmail_connected);
    setAliasCounts(data.alias_counts);
    setGmailCategoryCounts(data.gmail_category_counts);
  }, [aliasFilter, gmailCategoryFilter]);

  const fetchDrafts = useCallback(async () => {
    const res = await fetch('/api/admin/drafts?status=pending');
    if (!res.ok) return;
    const data = await res.json() as { drafts: Draft[] };
    setDrafts(data.drafts);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchInbox(), fetchDrafts()]).finally(() => setLoading(false));
  }, [fetchInbox, fetchDrafts]);

  async function approve(draftId: string) {
    const edit = editing[draftId];
    const res = await fetch('/api/admin/drafts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, action: 'approve', subject: edit?.subject, body_text: edit?.body }),
    });
    if (res.ok) {
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    } else {
      const err = await res.json() as { error?: string };
      alert(`Send failed: ${err.error ?? 'unknown error'}`);
    }
  }

  async function refresh() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_job', jobId: 'gmail-sync' }),
      });
      const data = await res.json() as {
        run?: { status: string; result?: { scanned?: number; synced?: number; drafts?: number; errors?: string[] }; error?: string | null };
        error?: string;
      };

      if (!res.ok || !data.run) {
        setSyncMessage(`Sync failed: ${data.error ?? 'unknown error'}`);
      } else if (data.run.status === 'failed') {
        setSyncMessage(`Sync failed: ${data.run.error ?? 'unknown error'}`);
      } else {
        const r = data.run.result ?? {};
        setSyncMessage(
          r.synced
            ? `Synced ${r.synced} new email${r.synced === 1 ? '' : 's'}${r.drafts ? ` — ${r.drafts} draft${r.drafts === 1 ? '' : 's'} ready` : ''}.`
            : `Checked ${r.scanned ?? 0} recent messages — nothing new.`
        );
        await Promise.all([fetchInbox(), fetchDrafts()]);
      }
    } catch (err) {
      setSyncMessage(`Sync failed: ${err instanceof Error ? err.message : 'network error'}`);
    } finally {
      setSyncing(false);
    }
  }

  async function reject(draftId: string) {
    const res = await fetch('/api/admin/drafts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draftId, action: 'reject' }),
    });
    if (res.ok) setDrafts(prev => prev.filter(d => d.id !== draftId));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inbox</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            All @flowen.digital aliases, synced hourly from admin@ on Google Workspace.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={refresh}
            disabled={syncing || connected === false}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={syncing ? 'animate-spin' : ''}>
              <path d="M17 10a7 7 0 1 1-2.05-4.95M17 3v4h-4" />
            </svg>
            {syncing ? 'Syncing…' : 'Refresh'}
          </button>
          {syncMessage && <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs text-right">{syncMessage}</p>}
        </div>
      </div>

      {connected === false && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl p-5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Gmail isn&apos;t connected yet</p>
          <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1 mb-3">
            Connect admin@flowen.digital once to start syncing all aliases, applying labels, and drafting replies.
          </p>
          <a href="/api/admin/gmail/connect" className="inline-block px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors">
            Connect Gmail →
          </a>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('inbox')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'inbox' ? 'border-emerald-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
        >
          All Mail ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('drafts')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'drafts' ? 'border-emerald-500 text-slate-900 dark:text-white' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
        >
          Drafts Awaiting Approval ({drafts.length})
        </button>
      </div>

      {tab === 'inbox' && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">By alias</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setAliasFilter(null)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${!aliasFilter ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                All
              </button>
              {Object.entries(aliasCounts).sort((a, b) => b[1] - a[1]).map(([alias, count]) => (
                <button
                  key={alias}
                  type="button"
                  onClick={() => setAliasFilter(aliasFilter === alias ? null : alias)}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-colors ${aliasFilter === alias ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                >
                  {alias}@ ({count})
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">By type (Gmail)</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setGmailCategoryFilter(null)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${!gmailCategoryFilter ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                All
              </button>
              {Object.entries(GMAIL_CATEGORY_LABEL).map(([key, label]) => {
                const count = gmailCategoryCounts[key] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGmailCategoryFilter(gmailCategoryFilter === key ? null : key)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${gmailCategoryFilter === key ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    {GMAIL_CATEGORY_ICON[key]} {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : tab === 'inbox' ? (
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-slate-400">No mail synced yet.</p>}
          {items.map(item => (
            <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[item.category] ?? CATEGORY_COLOR.general}`}>
                      {item.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{item.alias}@flowen.digital</span>
                    {item.gmail_category && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {GMAIL_CATEGORY_ICON[item.gmail_category]} {GMAIL_CATEGORY_LABEL[item.gmail_category]}
                      </span>
                    )}
                    {item.ai_drafts?.[0] && (
                      <span className={`text-[10px] font-mono ${confidenceColor(item.ai_drafts[0].confidence_pct)}`}>
                        draft: {item.ai_drafts[0].confidence_pct}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.subject}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {item.from_name ?? item.from_address} — {item.snippet}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(item.received_at).toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.length === 0 && <p className="text-sm text-slate-400">Nothing waiting on you right now.</p>}
          {drafts.map(draft => {
            const edit = editing[draft.id] ?? { subject: draft.subject, body: draft.body_text };
            return (
              <div key={draft.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">{draft.from_alias}@flowen.digital</span>
                    {' → '}{draft.to_address}
                    {draft.inbox_items && <span className="ml-2 text-slate-400">re: {draft.inbox_items.subject}</span>}
                  </div>
                  <span className={`text-xs font-mono font-bold ${confidenceColor(draft.confidence_pct)}`}>
                    {draft.confidence_pct}% confidence
                  </span>
                </div>
                <input
                  value={edit.subject}
                  onChange={e => setEditing(prev => ({ ...prev, [draft.id]: { ...edit, subject: e.target.value } }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                />
                <textarea
                  value={edit.body}
                  onChange={e => setEditing(prev => ({ ...prev, [draft.id]: { ...edit, body: e.target.value } }))}
                  rows={6}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed resize-y"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => reject(draft.id)} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    Reject
                  </button>
                  <button type="button" onClick={() => approve(draft.id)} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition-colors">
                    Approve &amp; Send
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
