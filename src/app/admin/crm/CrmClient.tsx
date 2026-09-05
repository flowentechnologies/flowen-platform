'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface Contact {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  category: string;
  stage: string;
  source: string | null;
  last_contact_at: string | null;
  notes: string | null;
  deal_value_pence: number | null;
  deal_currency: string | null;
}

interface Activity {
  id: string;
  type: string;
  body: string | null;
  occurred_at: string;
}

interface EmailSummary {
  id: string;
  subject: string;
  snippet: string;
  received_at: string;
  status: string;
  alias: string;
}

const STAGES = ['new', 'contacted', 'in_discussion', 'won', 'lost'] as const;
const STAGE_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', in_discussion: 'In Discussion', won: 'Won', lost: 'Lost',
};
const CATEGORY_LABEL: Record<string, string> = {
  investor: 'Investor', grant: 'Grant', nhs_partner: 'NHS Partner', press: 'Press',
  affiliate: 'Affiliate', vendor: 'Vendor', other: 'Other',
};
const ACTIVITY_ICON: Record<string, string> = {
  email_inbound: '📥', email_outbound: '📤', call: '📞', meeting: '🤝', note: '📝', stage_change: '🔀',
};
const ACTIVITY_LABEL: Record<string, string> = {
  email_inbound: 'Email received', email_outbound: 'Email sent', call: 'Call', meeting: 'Meeting',
  note: 'Note', stage_change: 'Stage change',
};

function formatDeal(pence: number | null, currency: string | null): string | null {
  if (pence == null) return null;
  return (pence / 100).toLocaleString('en-GB', { style: 'currency', currency: (currency ?? 'gbp').toUpperCase() });
}

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

interface Overview {
  total_contacts: number;
  by_category: Record<string, number>;
  by_stage: Record<string, number>;
  deal_value_by_category_pence: Record<string, number>;
  vendor_spend_30d_pence: number;
  vendor_spend_by_vendor_pence: Record<string, number>;
  venture: { cash_in_bank_pence: number | null; monthly_burn_pence: number | null; target_raise_pence: number | null; committed_pence: number | null } | null;
}

function gbp(pence: number | null | undefined): string {
  if (pence == null) return '—';
  return (pence / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
}

export function CrmClient() {
  const searchParams = useSearchParams();
  const deepLinkContact = searchParams.get('contact');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [generatingRecs, setGeneratingRecs] = useState(false);

  const fetchOverview = useCallback(async () => {
    const res = await fetch('/api/admin/crm/overview');
    if (!res.ok) return;
    setOverview(await res.json() as Overview);
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  async function scanInbox() {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/admin/crm/scan', { method: 'POST' });
      const data = await res.json() as { scanned?: number; added?: number; skipped?: number; error?: string };
      if (!res.ok) {
        setScanMessage(`Scan failed: ${data.error ?? 'unknown error'}`);
      } else {
        setScanMessage(`Scanned ${data.scanned} senders — added ${data.added}, skipped ${data.skipped}.`);
        await Promise.all([fetchContacts(categoryFilter || undefined), fetchOverview()]);
      }
    } catch (err) {
      setScanMessage(`Scan failed: ${err instanceof Error ? err.message : 'network error'}`);
    } finally {
      setScanning(false);
    }
  }

  async function generateRecommendations() {
    setGeneratingRecs(true);
    try {
      const res = await fetch('/api/admin/crm/overview', { method: 'POST' });
      const data = await res.json() as { recommendations?: string; error?: string };
      setRecommendations(res.ok ? (data.recommendations ?? null) : `Failed: ${data.error ?? 'unknown error'}`);
    } catch (err) {
      setRecommendations(`Failed: ${err instanceof Error ? err.message : 'network error'}`);
    } finally {
      setGeneratingRecs(false);
    }
  }

  const fetchContacts = useCallback(async (category?: string) => {
    const url = category ? `/api/admin/crm?category=${category}` : '/api/admin/crm';
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as { contacts: Contact[] };
    setContacts(data.contacts);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchContacts(categoryFilter || undefined).finally(() => setLoading(false));
  }, [fetchContacts, categoryFilter]);

  useEffect(() => {
    if (deepLinkContact && !loading) setOpenContactId(deepLinkContact);
  }, [deepLinkContact, loading]);

  async function moveStage(id: string, stage: string) {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, stage } : c)));
    await fetch('/api/admin/crm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stage }),
    });
  }

  const byStage = STAGES.map(stage => ({ stage, contacts: contacts.filter(c => c.stage === stage) }));
  const openContact = contacts.find(c => c.id === openContactId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CRM Pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Investors, grants, NHS partnerships, press, and affiliates — one pipeline, sourced automatically from inbox activity.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={scanInbox}
              disabled={scanning}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {scanning ? 'Scanning…' : 'Scan inbox for contacts'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 transition-colors flex-shrink-0"
            >
              + Add contact
            </button>
          </div>
          {scanMessage && <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs text-right">{scanMessage}</p>}
        </div>
      </div>

      {overview && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Overview</p>
            <button
              type="button"
              onClick={generateRecommendations}
              disabled={generatingRecs}
              className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-xs font-bold text-white disabled:opacity-50 transition-colors"
            >
              {generatingRecs ? 'Thinking…' : '✨ Recommended next steps'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{overview.total_contacts}</p>
              <p className="text-[11px] text-slate-400">Total contacts</p>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{overview.by_category.investor ?? 0}</p>
              <p className="text-[11px] text-slate-400">Investors</p>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{overview.by_category.nhs_partner ?? 0}</p>
              <p className="text-[11px] text-slate-400">NHS / ICB partners</p>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{overview.by_category.grant ?? 0}</p>
              <p className="text-[11px] text-slate-400">Grant contacts</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{gbp(Object.values(overview.deal_value_by_category_pence).reduce((a, b) => a + b, 0))}</p>
              <p className="text-[11px] text-slate-400">Total deal value tracked</p>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{gbp(overview.vendor_spend_30d_pence)}</p>
              <p className="text-[11px] text-slate-400">Vendor spend (30d)</p>
            </div>
            {overview.venture && (
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {gbp(overview.venture.committed_pence)} / {gbp(overview.venture.target_raise_pence)}
                </p>
                <p className="text-[11px] text-slate-400">Round committed / target</p>
              </div>
            )}
          </div>
          {recommendations && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-2">Recommended next steps</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{recommendations}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${!categoryFilter ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategoryFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${categoryFilter === key ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {byStage.map(({ stage, contacts: stageContacts }) => (
            <div key={stage} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {STAGE_LABEL[stage]} ({stageContacts.length})
              </p>
              <div className="space-y-2">
                {stageContacts.map(c => {
                  const deal = formatDeal(c.deal_value_pence, c.deal_currency);
                  return (
                    <div
                      key={c.id}
                      onClick={() => setOpenContactId(c.id)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-colors"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.name ?? c.email}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{c.company ?? c.email}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {CATEGORY_LABEL[c.category] ?? c.category}
                        </span>
                        {deal && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {deal}
                          </span>
                        )}
                      </div>
                      <select
                        value={c.stage}
                        onClick={e => e.stopPropagation()}
                        onChange={e => moveStage(c.id, e.target.value)}
                        className="mt-2 w-full text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-1.5 py-1 text-slate-600 dark:text-slate-300"
                      >
                        {STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {openContact && (
        <ContactDetail
          contact={openContact}
          onClose={() => setOpenContactId(null)}
          onUpdated={patch => setContacts(prev => prev.map(c => (c.id === openContact.id ? { ...c, ...patch } : c)))}
        />
      )}

      {showAddModal && (
        <AddContactModal
          onClose={() => setShowAddModal(false)}
          onCreated={contact => { setContacts(prev => [contact, ...prev]); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}

function AddContactModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (contact: Contact) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('other');
  const [notes, setNotes] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) { setError('Email is required'); return; }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        name: name.trim() || undefined,
        company: company.trim() || undefined,
        category,
        notes: notes.trim() || undefined,
        deal_value_pence: dealValue.trim() ? Math.round(parseFloat(dealValue) * 100) : undefined,
      }),
    });
    const data = await res.json() as { contact?: Contact; error?: string };
    setSaving(false);
    if (!res.ok || !data.contact) {
      setError(data.error ?? 'Failed to create contact');
      return;
    }
    onCreated(data.contact);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/50" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-slate-900 dark:text-white">Add contact</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        {error && <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Email *</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full mt-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full mt-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Company</label>
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="w-full mt-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full mt-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300"
              >
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deal value (£)</label>
              <input
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                placeholder="0.00"
                className="w-full mt-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 resize-y"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Add contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactDetail({ contact, onClose, onUpdated }: {
  contact: Contact;
  onClose: () => void;
  onUpdated: (patch: Partial<Contact>) => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [dealInput, setDealInput] = useState(contact.deal_value_pence != null ? String(contact.deal_value_pence / 100) : '');
  const [notesInput, setNotesInput] = useState(contact.notes ?? '');
  const [logType, setLogType] = useState<'call' | 'meeting' | 'note'>('note');
  const [logBody, setLogBody] = useState('');
  const [logging, setLogging] = useState(false);

  const fetchTimeline = useCallback(async () => {
    const res = await fetch(`/api/admin/crm/${contact.id}/activities`);
    if (!res.ok) return;
    const data = await res.json() as { activities: Activity[]; emails: EmailSummary[] };
    setActivities(data.activities);
    setEmails(data.emails);
  }, [contact.id]);

  useEffect(() => {
    setLoadingTimeline(true);
    fetchTimeline().finally(() => setLoadingTimeline(false));
  }, [fetchTimeline]);

  async function saveDeal() {
    const pence = dealInput.trim() ? Math.round(parseFloat(dealInput) * 100) : null;
    onUpdated({ deal_value_pence: pence });
    await fetch('/api/admin/crm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, deal_value_pence: pence }),
    });
  }

  async function saveNotes() {
    onUpdated({ notes: notesInput });
    await fetch('/api/admin/crm', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contact.id, notes: notesInput }),
    });
  }

  async function logInteraction() {
    if (!logBody.trim()) return;
    setLogging(true);
    const res = await fetch(`/api/admin/crm/${contact.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: logType, body: logBody }),
    });
    if (res.ok) {
      setLogBody('');
      await fetchTimeline();
    }
    setLogging(false);
  }

  // Merge auto-logged activities with the actual emails (which carry real
  // subject/snippet content, not just a generic "email" log line) into one
  // timestamp-sorted timeline. Skip email_inbound/email_outbound activity
  // rows entirely where an actual email record covers the same event.
  const timeline = [
    ...activities.filter(a => a.type !== 'email_inbound' && a.type !== 'email_outbound').map(a => ({
      id: a.id, icon: ACTIVITY_ICON[a.type], label: ACTIVITY_LABEL[a.type] ?? a.type, body: a.body, at: a.occurred_at,
    })),
    ...emails.map(e => ({
      id: e.id, icon: e.status === 'responded' ? '📤' : '📥', label: e.status === 'responded' ? 'Email exchanged' : 'Email received',
      body: e.subject, at: e.received_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/50" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{contact.name ?? contact.email}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{contact.email}{contact.company ? ` · ${contact.company}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Deal value</label>
            <div className="flex gap-1.5 mt-1">
              <input
                value={dealInput}
                onChange={e => setDealInput(e.target.value)}
                onBlur={saveDeal}
                placeholder="0.00"
                className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Category</label>
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1.5">{CATEGORY_LABEL[contact.category] ?? contact.category}</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notes</label>
          <textarea
            value={notesInput}
            onChange={e => setNotesInput(e.target.value)}
            onBlur={saveNotes}
            rows={2}
            className="w-full mt-1 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 resize-y"
          />
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Log an interaction</label>
          <div className="flex gap-1.5">
            <select value={logType} onChange={e => setLogType(e.target.value as typeof logType)} className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300">
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
            </select>
            <input
              value={logBody}
              onChange={e => setLogBody(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && logInteraction()}
              placeholder="What happened?"
              className="flex-1 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300"
            />
            <button type="button" onClick={logInteraction} disabled={logging || !logBody.trim()} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 disabled:opacity-50 transition-colors">
              Log
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Timeline</label>
          {loadingTimeline ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {timeline.map(entry => (
                <div key={entry.id} className="flex items-start gap-2.5">
                  <span className="text-sm">{entry.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 dark:text-slate-300">{entry.body}</p>
                    <p className="text-[10px] text-slate-400">{timeAgo(entry.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
