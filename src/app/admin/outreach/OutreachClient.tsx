'use client';

import { useState, useEffect, useCallback } from 'react';

interface Snapshot {
  total_emails_sent: number;
  total_replies: number;
  total_auto_replies: number;
  overall_reply_rate_pct: number;
  total_hot_leads: number;
  total_spend_usd: number;
  captured_at: string;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  status_reason: string | null;
  emails_sent: number;
  total_replies: number;
  reply_rate_pct: number;
  hot_leads: number;
  spend_usd: number;
  cost_per_lead_usd: number;
  leads_pool_used: number;
  leads_pool_total: number;
  collected_leads_total: number;
  daily_budget_usd: number;
}

interface Contact {
  id: string;
  campaign_id: number;
  person_id: string;
  email: string | null;
  name: string | null;
  latest_subject: string | null;
  latest_sent_at: string | null;
  latest_reply_at: string | null;
  latest_intent: string | null;
  sent_count: number;
  reply_count: number;
  crm_contact_id: string | null;
}

interface Message {
  type: 'sent' | 'reply';
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  body_text: string | null;
  sent_at: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  outreach: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  searching: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  listening: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  discovery: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
};

const INTENT_LABEL: Record<string, string> = {
  hot_lead: '🔥 Hot lead',
  not_interested: 'Not interested',
  out_of_office: 'Out of office',
  unsubscribe: 'Unsubscribed',
};

function fmtUsd(n: number | null | undefined): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function OutreachClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState<{ campaignId: number; personId: string } | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  // Campaign start/stop/budget controls — one per-campaign busy/error/draft
  // slot, keyed by campaign id, so acting on one campaign never disturbs
  // another row's state.
  const [controlling, setControlling] = useState<Record<number, boolean>>({});
  const [controlError, setControlError] = useState<Record<number, string>>({});
  const [budgetDrafts, setBudgetDrafts] = useState<Record<number, string>>({});

  // Project-level Autopilot / auto-reply settings.
  const [autopilot, setAutopilot] = useState<{
    autopilot_enabled: boolean; auto_reply_enabled: boolean; auto_reply_delay_minutes: number;
  } | null>(null);
  const [autopilotSaving, setAutopilotSaving] = useState(false);
  const [autopilotError, setAutopilotError] = useState<string | null>(null);

  const fetchAutopilot = useCallback(async () => {
    const res = await fetch('/api/admin/outreach/autopilot');
    if (!res.ok) return;
    const data = await res.json() as { autopilot_enabled: boolean; auto_reply_enabled: boolean; auto_reply_delay_minutes: number };
    setAutopilot(data);
  }, []);

  useEffect(() => { fetchAutopilot(); }, [fetchAutopilot]);

  async function toggleAutopilot(field: 'autopilotEnabled' | 'autoReplyEnabled', value: boolean) {
    if (!autopilot) return;
    setAutopilotSaving(true);
    setAutopilotError(null);
    const res = await fetch('/api/admin/outreach/autopilot', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json() as { error?: string; autopilot_enabled?: boolean; auto_reply_enabled?: boolean };
    setAutopilotSaving(false);
    if (!res.ok) { setAutopilotError(data.error ?? 'Failed to update'); return; }
    setAutopilot(prev => prev && {
      ...prev,
      autopilot_enabled: data.autopilot_enabled ?? prev.autopilot_enabled,
      auto_reply_enabled: data.auto_reply_enabled ?? prev.auto_reply_enabled,
    });
  }

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/admin/explee-outreach');
    if (!res.ok) return;
    const data = await res.json() as { snapshot: Snapshot | null; campaigns: Campaign[]; contacts: Contact[] };
    setSnapshot(data.snapshot);
    setCampaigns(data.campaigns);
    setContacts(data.contacts);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, not a cascading render
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  async function openContactThread(contact: Contact) {
    const key = { campaignId: contact.campaign_id, personId: contact.person_id };
    if (openThread?.campaignId === key.campaignId && openThread?.personId === key.personId) {
      setOpenThread(null);
      return;
    }
    setOpenThread(key);
    setThreadLoading(true);
    const res = await fetch(`/api/admin/explee-outreach?campaign=${key.campaignId}&person=${encodeURIComponent(key.personId)}`);
    const data = await res.json() as { messages: Message[] };
    setThreadMessages(data.messages ?? []);
    setThreadLoading(false);
  }

  async function controlCampaign(campaignId: number, action: 'start' | 'stop') {
    setControlling(prev => ({ ...prev, [campaignId]: true }));
    setControlError(prev => ({ ...prev, [campaignId]: '' }));
    const res = await fetch('/api/admin/outreach/campaign-control', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, action }),
    });
    const data = await res.json() as { error?: string };
    setControlling(prev => ({ ...prev, [campaignId]: false }));
    if (!res.ok) {
      setControlError(prev => ({ ...prev, [campaignId]: data.error ?? 'Failed' }));
      return;
    }
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: action === 'stop' ? 'stopped' : 'outreach' } : c));
  }

  async function saveBudget(campaignId: number) {
    const raw = budgetDrafts[campaignId];
    const dailyLimitUsd = Number(raw);
    if (!raw || !Number.isFinite(dailyLimitUsd) || dailyLimitUsd < 1 || dailyLimitUsd > 300) {
      setControlError(prev => ({ ...prev, [campaignId]: 'Budget must be $1-300/day' }));
      return;
    }
    setControlling(prev => ({ ...prev, [campaignId]: true }));
    setControlError(prev => ({ ...prev, [campaignId]: '' }));
    const res = await fetch('/api/admin/outreach/campaign-control', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, action: 'set_budget', dailyLimitUsd }),
    });
    const data = await res.json() as { error?: string; dailyLimitUsd?: number };
    setControlling(prev => ({ ...prev, [campaignId]: false }));
    if (!res.ok) {
      setControlError(prev => ({ ...prev, [campaignId]: data.error ?? 'Failed' }));
      return;
    }
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, daily_budget_usd: data.dailyLimitUsd ?? c.daily_budget_usd } : c));
    setBudgetDrafts(prev => { const next = { ...prev }; delete next[campaignId]; return next; });
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Outreach (Explee)</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Every campaign, every contact, every email sent or replied — synced automatically every 10 minutes.
            Hot leads also flow into the <a href="/admin/crm" className="text-emerald-600 dark:text-emerald-400 hover:underline">CRM Pipeline</a>.
          </p>
        </div>
        <a href="/admin/outreach/suppress-list" className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0">
          Suppress lists ↗
        </a>
      </div>

      {/* Project-level Autopilot / auto-reply controls */}
      {autopilot && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => toggleAutopilot('autopilotEnabled', !autopilot.autopilot_enabled)}
              disabled={autopilotSaving}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${autopilot.autopilot_enabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}
            >
              Autopilot: {autopilot.autopilot_enabled ? 'ON' : 'OFF'}
            </button>
            <span className="text-[10px] text-slate-400">
              {autopilot.autopilot_enabled ? 'Explee manages campaigns + budget split — per-campaign budget edits will 409.' : 'You control campaign budgets manually.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => toggleAutopilot('autoReplyEnabled', !autopilot.auto_reply_enabled)}
              disabled={autopilotSaving}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${autopilot.auto_reply_enabled ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}
            >
              Auto-reply: {autopilot.auto_reply_enabled ? 'ON' : 'OFF'}
            </button>
            <span className="text-[10px] text-slate-400">
              {autopilot.auto_reply_enabled ? `AI replies to hot leads after ${autopilot.auto_reply_delay_minutes}min.` : 'Replies always sent manually.'}
            </span>
          </div>
          {autopilotError && <p className="text-[10px] text-rose-500">{autopilotError}</p>}
        </div>
      )}

      {/* Project rollup cards */}
      {snapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Emails sent', value: snapshot.total_emails_sent.toLocaleString() },
            { label: 'Replies', value: snapshot.total_replies.toLocaleString() },
            { label: 'Reply rate', value: `${snapshot.overall_reply_rate_pct.toFixed(1)}%` },
            { label: 'Hot leads', value: snapshot.total_hot_leads.toLocaleString() },
            { label: 'Spend', value: fmtUsd(snapshot.total_spend_usd) },
          ].map(card => (
            <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{card.value}</p>
            </div>
          ))}
        </div>
      )}
      {!snapshot && (
        <p className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          No sync data yet — the first run of explee-outreach-sync (every 10 minutes) will populate this.
        </p>
      )}

      {/* Campaigns table */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Campaigns</h2>
        <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                <th className="text-left px-4 py-2.5 font-semibold">Campaign</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-right px-4 py-2.5 font-semibold">Sent</th>
                <th className="text-right px-4 py-2.5 font-semibold">Replies</th>
                <th className="text-right px-4 py-2.5 font-semibold">Reply %</th>
                <th className="text-right px-4 py-2.5 font-semibold">Hot leads</th>
                <th className="text-right px-4 py-2.5 font-semibold">Spend</th>
                <th className="text-right px-4 py-2.5 font-semibold">$/lead</th>
                <th className="text-right px-4 py-2.5 font-semibold">Daily budget</th>
                <th className="text-right px-4 py-2.5 font-semibold">Controls</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{c.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${STATUS_BADGE[c.status] ?? 'bg-slate-500/10 text-slate-500 border-slate-500/30'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{c.emails_sent}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{c.total_replies}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{c.reply_rate_pct.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{c.hot_leads}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{fmtUsd(c.spend_usd)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">{c.hot_leads > 0 ? fmtUsd(c.cost_per_lead_usd) : '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        value={budgetDrafts[c.id] ?? String(c.daily_budget_usd)}
                        onChange={e => setBudgetDrafts(prev => ({ ...prev, [c.id]: e.target.value }))}
                        className="w-14 text-right bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1 py-0.5 text-[11px] text-slate-700 dark:text-slate-300"
                      />
                      <button
                        type="button" onClick={() => saveBudget(c.id)} disabled={controlling[c.id]}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => controlCampaign(c.id, c.status === 'stopped' ? 'start' : 'stop')}
                      disabled={controlling[c.id]}
                      className={`text-[10px] font-semibold px-2 py-1 rounded ${c.status === 'stopped' ? 'bg-emerald-500 text-white' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'} disabled:opacity-40`}
                    >
                      {controlling[c.id] ? '…' : c.status === 'stopped' ? 'Start' : 'Stop'}
                    </button>
                    {controlError[c.id] && <p className="text-[9px] text-rose-500 mt-1 max-w-[140px] whitespace-normal">{controlError[c.id]}</p>}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">No campaigns synced yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contacts + thread viewer */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
          Contacted people ({contacts.length}{contacts.length === 300 ? '+' : ''})
        </h2>
        <div className="space-y-1.5">
          {contacts.map(contact => {
            const campaign = campaigns.find(c => c.id === contact.campaign_id);
            const isOpen = openThread?.campaignId === contact.campaign_id && openThread?.personId === contact.person_id;
            return (
              <div key={contact.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => openContactThread(contact)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {contact.name ?? contact.email ?? 'No reply yet (address hidden)'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {campaign?.name ?? `Campaign ${contact.campaign_id}`} · {contact.latest_subject ?? '—'}
                    </p>
                  </div>
                  {contact.latest_intent && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                      {INTENT_LABEL[contact.latest_intent] ?? contact.latest_intent}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 shrink-0 w-24 text-right">
                    {contact.sent_count} sent · {contact.reply_count} replied
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0 w-28 text-right">
                    {fmtDate(contact.latest_reply_at ?? contact.latest_sent_at)}
                  </span>
                  {contact.crm_contact_id && (
                    <a
                      href={`/admin/crm?contact=${contact.crm_contact_id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      In CRM ↗
                    </a>
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-2.5 bg-slate-50/50 dark:bg-slate-950/40">
                    {threadLoading ? (
                      <p className="text-[11px] text-slate-400">Loading thread…</p>
                    ) : threadMessages.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No messages stored for this thread yet.</p>
                    ) : (
                      threadMessages.map((m, i) => (
                        <div key={i} className={`text-[11px] rounded-lg p-2.5 ${m.type === 'sent' ? 'bg-slate-100 dark:bg-slate-800/60' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'}`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {m.type === 'sent' ? '📤 Sent' : '📥 Reply'}{m.subject ? ` — ${m.subject}` : ''}
                            </span>
                            <span className="text-slate-400 font-mono shrink-0">{fmtDate(m.sent_at)}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{m.body_text ?? '(no body stored)'}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {contacts.length === 0 && (
            <p className="text-xs text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
              No contacts synced yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
