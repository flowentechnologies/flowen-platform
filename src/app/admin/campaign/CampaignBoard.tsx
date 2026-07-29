'use client';

import React, { useState, useTransition, useOptimistic } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ContactType = 'mp' | 'influencer' | 'journalist' | 'clinician' | 'ngo';
type OutreachStatus = 'identified' | 'contacted' | 'responded' | 'meeting_booked' | 'supporting' | 'declined';
type MilestoneStatus = 'upcoming' | 'in_progress' | 'achieved' | 'delayed';

interface Contact {
  id: string;
  name: string;
  type: ContactType;
  organisation: string | null;
  constituency: string | null;
  platform: string | null;
  followers_count: number | null;
  email: string | null;
  notes: string | null;
  status: OutreachStatus;
  contacted_at: string | null;
  responded_at: string | null;
  created_at: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  category: string;
  target_date: string | null;
  achieved_date: string | null;
  status: MilestoneStatus;
  created_at: string;
}

interface PressLink {
  id: string;
  title: string;
  publication: string;
  url: string | null;
  published_date: string | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  created_at: string;
}

interface Props {
  initialMilestones: Milestone[];
  initialContacts:   Contact[];
  initialPress:      PressLink[];
}

// ── Label maps ────────────────────────────────────────────────────────────────

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  mp:         'MP',
  influencer: 'Influencer',
  journalist: 'Journalist',
  clinician:  'Clinician',
  ngo:        'NGO',
};

const STATUS_CONFIG: Record<OutreachStatus, { label: string; color: string }> = {
  identified:    { label: 'Identified',    color: 'bg-slate-700 text-slate-400' },
  contacted:     { label: 'Contacted',     color: 'bg-blue-500/10 text-blue-400' },
  responded:     { label: 'Responded',     color: 'bg-indigo-500/10 text-indigo-400' },
  meeting_booked:{ label: 'Meeting',       color: 'bg-purple-500/10 text-purple-400' },
  supporting:    { label: 'Supporting',    color: 'bg-emerald-500/10 text-emerald-400' },
  declined:      { label: 'Declined',      color: 'bg-red-500/10 text-red-400' },
};

const MILESTONE_CONFIG: Record<MilestoneStatus, { label: string; dot: string; badge: string }> = {
  upcoming:    { label: 'Upcoming',     dot: 'bg-slate-500',   badge: 'bg-slate-800 text-slate-400' },
  in_progress: { label: 'In Progress',  dot: 'bg-blue-400 animate-pulse', badge: 'bg-blue-500/10 text-blue-400' },
  achieved:    { label: 'Achieved',     dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400' },
  delayed:     { label: 'Delayed',      dot: 'bg-amber-400',   badge: 'bg-amber-500/10 text-amber-400' },
};

const CATEGORY_LABELS: Record<string, string> = {
  petition: 'Petition',
  nhs:      'NHS',
  growth:   'Growth',
  press:    'Press',
  funding:  'Funding',
  general:  'General',
};

const SENTIMENT_CONFIG = {
  positive: { label: 'Positive', color: 'bg-emerald-500/10 text-emerald-400' },
  neutral:  { label: 'Neutral',  color: 'bg-slate-700 text-slate-400' },
  negative: { label: 'Negative', color: 'bg-red-500/10 text-red-400' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtFollowers(n: number | null) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

async function api(action: string, payload: Record<string, unknown>) {
  const res = await fetch('/api/admin/campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── Status dropdown ───────────────────────────────────────────────────────────

function StatusDropdown({
  contactId,
  current,
  onUpdate,
}: {
  contactId: string;
  current: OutreachStatus;
  onUpdate: (id: string, status: OutreachStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[current];

  async function select(status: OutreachStatus) {
    setOpen(false);
    setLoading(true);
    await api('update_contact_status', { id: contactId, status });
    onUpdate(contactId, status);
    setLoading(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={loading}
        className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${cfg.color} ${loading ? 'opacity-40' : 'hover:opacity-80'}`}
      >
        {cfg.label} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-xl min-w-[140px]">
          {(Object.entries(STATUS_CONFIG) as [OutreachStatus, { label: string; color: string }][]).map(([s, c]) => (
            <button
              key={s}
              type="button"
              onClick={() => select(s)}
              className={`w-full text-left px-3 py-2 text-[11px] font-mono hover:bg-slate-800 transition-colors ${s === current ? 'text-white font-bold' : 'text-slate-400'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Milestone status dropdown ─────────────────────────────────────────────────

function MilestoneStatusDropdown({
  milestoneId,
  current,
  onUpdate,
}: {
  milestoneId: string;
  current: MilestoneStatus;
  onUpdate: (id: string, status: MilestoneStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const cfg = MILESTONE_CONFIG[current];

  async function select(status: MilestoneStatus) {
    setOpen(false);
    setLoading(true);
    await api('update_milestone_status', { id: milestoneId, status });
    onUpdate(milestoneId, status);
    setLoading(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={loading}
        className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${cfg.badge} ${loading ? 'opacity-40' : 'hover:opacity-80'} transition-colors`}
      >
        {cfg.label} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-xl min-w-[140px]">
          {(Object.entries(MILESTONE_CONFIG) as [MilestoneStatus, { label: string; dot: string; badge: string }][]).map(([s, c]) => (
            <button
              key={s}
              type="button"
              onClick={() => select(s)}
              className={`w-full text-left px-3 py-2 text-[11px] font-mono hover:bg-slate-800 transition-colors ${s === current ? 'text-white font-bold' : 'text-slate-400'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Contact modal ─────────────────────────────────────────────────────────

function AddContactModal({ onAdd }: { onAdd: (c: Contact) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'mp' as ContactType, organisation: '', constituency: '', platform: '', followers_count: '', email: '', notes: '', status: 'identified' as OutreachStatus });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.name) { setError('Name is required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await api('create_contact', form);
      if (res.error) { setError(res.error); return; }
      onAdd(res.data);
      setOpen(false);
      setForm({ name: '', type: 'mp', organisation: '', constituency: '', platform: '', followers_count: '', email: '', notes: '', status: 'identified' });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        + Add Contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Campaign Contact</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Name *</label>
                  <input value={form.name} onChange={e => field('name', e.target.value)} placeholder="Full name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Type *</label>
                  <select value={form.type} onChange={e => field('type', e.target.value as ContactType)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                    {(Object.entries(CONTACT_TYPE_LABELS) as [ContactType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Organisation</label>
                <input value={form.organisation} onChange={e => field('organisation', e.target.value)} placeholder="Party, media outlet, hospital…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>
              {form.type === 'mp' && (
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Constituency</label>
                  <input value={form.constituency} onChange={e => field('constituency', e.target.value)} placeholder="e.g. Birmingham, Selly Oak" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
              )}
              {form.type === 'influencer' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Platform</label>
                    <input value={form.platform} onChange={e => field('platform', e.target.value)} placeholder="Instagram, YouTube…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Followers</label>
                    <input type="number" value={form.followers_count} onChange={e => field('followers_count', e.target.value)} placeholder="250000" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => field('email', e.target.value)} placeholder="contact@example.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Initial Status</label>
                <select value={form.status} onChange={e => field('status', e.target.value as OutreachStatus)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                  {(Object.entries(STATUS_CONFIG) as [OutreachStatus, { label: string }][]).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => field('notes', e.target.value)} rows={3} placeholder="Context, talking points, relationship notes…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none font-mono" />
              </div>
              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={submit} disabled={isPending} className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                {isPending ? 'Saving…' : 'Add Contact'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Add Milestone modal ───────────────────────────────────────────────────────

function AddMilestoneModal({ onAdd }: { onAdd: (m: Milestone) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', target_date: '', status: 'upcoming' as MilestoneStatus });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(key: keyof typeof form, value: string) { setForm(f => ({ ...f, [key]: value })); }

  function submit() {
    if (!form.title) { setError('Title is required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await api('create_milestone', form);
      if (res.error) { setError(res.error); return; }
      onAdd(res.data);
      setOpen(false);
      setForm({ title: '', description: '', category: 'general', target_date: '', status: 'upcoming' });
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        + Add Milestone
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Milestone</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Title *</label>
                <input value={form.title} onChange={e => field('title', e.target.value)} placeholder="Milestone name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Category</label>
                  <select value={form.category} onChange={e => field('category', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Target Date</label>
                  <input type="date" value={form.target_date} onChange={e => field('target_date', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Status</label>
                <select value={form.status} onChange={e => field('status', e.target.value as MilestoneStatus)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                  {(Object.entries(MILESTONE_CONFIG) as [MilestoneStatus, { label: string }][]).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => field('description', e.target.value)} rows={3} placeholder="What does achieving this look like?" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>
              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={submit} disabled={isPending} className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                {isPending ? 'Saving…' : 'Add Milestone'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Add Press modal ───────────────────────────────────────────────────────────

function AddPressModal({ onAdd }: { onAdd: (p: PressLink) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', publication: '', url: '', published_date: '', sentiment: 'positive' as 'positive' | 'neutral' | 'negative' });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(key: keyof typeof form, value: string) { setForm(f => ({ ...f, [key]: value })); }

  function submit() {
    if (!form.title || !form.publication) { setError('Title and publication are required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await api('create_press', form);
      if (res.error) { setError(res.error); return; }
      onAdd(res.data);
      setOpen(false);
      setForm({ title: '', publication: '', url: '', published_date: '', sentiment: 'positive' });
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        + Add Press
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Press Mention</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Headline *</label>
                <input value={form.title} onChange={e => field('title', e.target.value)} placeholder="Article headline" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Publication *</label>
                  <input value={form.publication} onChange={e => field('publication', e.target.value)} placeholder="BBC, Guardian…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Published</label>
                  <input type="date" value={form.published_date} onChange={e => field('published_date', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">URL</label>
                <input type="url" value={form.url} onChange={e => field('url', e.target.value)} placeholder="https://…" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Sentiment</label>
                <select value={form.sentiment} onChange={e => field('sentiment', e.target.value as 'positive' | 'neutral' | 'negative')} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
              </div>
              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={submit} disabled={isPending} className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                {isPending ? 'Saving…' : 'Add'}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Milestones tab ────────────────────────────────────────────────────────────

function MilestonesTab({ milestones: initial }: { milestones: Milestone[] }) {
  const [milestones, setMilestones] = useOptimistic(initial, (prev, updated: Milestone[]) => updated);
  const [list, setList] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function handleStatusUpdate(id: string, status: MilestoneStatus) {
    const updated = list.map(m => m.id === id ? { ...m, status, achieved_date: status === 'achieved' ? new Date().toISOString().slice(0, 10) : m.achieved_date } : m);
    setList(updated);
    startTransition(() => { setMilestones(updated); });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await api('delete_milestone', { id });
      const updated = list.filter(m => m.id !== id);
      setList(updated);
      setMilestones(updated);
    });
  }

  function handleAdd(m: Milestone) {
    const updated = [...list, m].sort((a, b) => (a.target_date ?? '').localeCompare(b.target_date ?? ''));
    setList(updated);
    startTransition(() => { setMilestones(updated); });
  }

  const achieved = milestones.filter(m => m.status === 'achieved').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-slate-500">{achieved} of {milestones.length} achieved</p>
        <AddMilestoneModal onAdd={handleAdd} />
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: milestones.length > 0 ? `${(achieved / milestones.length) * 100}%` : '0%' }}
        />
      </div>

      <div className="space-y-3">
        {milestones.map(m => {
          const cfg = MILESTONE_CONFIG[m.status];
          return (
            <div key={m.id} className={`bg-slate-900 border rounded-xl px-5 py-4 flex items-start gap-4 transition-opacity ${m.status === 'achieved' ? 'border-emerald-500/20' : 'border-slate-800'}`}>
              <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-white">{m.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                    CATEGORY_LABELS[m.category] ? 'bg-slate-800 text-slate-400' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {CATEGORY_LABELS[m.category] ?? m.category}
                  </span>
                </div>
                {m.description && <p className="text-xs text-slate-500 leading-relaxed">{m.description}</p>}
                <p className="text-[10px] text-slate-600 font-mono mt-1">
                  {m.status === 'achieved' && m.achieved_date ? `Achieved ${fmtDate(m.achieved_date)}` : `Target: ${fmtDate(m.target_date)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <MilestoneStatusDropdown milestoneId={m.id} current={m.status} onUpdate={handleStatusUpdate} />
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={isPending}
                  className="text-slate-700 hover:text-red-400 transition-colors text-sm disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Contacts tab ──────────────────────────────────────────────────────────────

function ContactsTab({ contacts: initial }: { contacts: Contact[] }) {
  const [contacts, setContacts] = useState(initial);
  const [typeFilter, setTypeFilter] = useState<ContactType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleStatusUpdate(id: string, status: OutreachStatus) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await api('delete_contact', { id });
      setContacts(prev => prev.filter(c => c.id !== id));
    });
  }

  function handleAdd(c: Contact) {
    setContacts(prev => [c, ...prev]);
  }

  const filtered = contacts.filter(c => {
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || (c.organisation ?? '').toLowerCase().includes(q) || (c.constituency ?? '').toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const typeCounts = contacts.reduce<Record<string, number>>((acc, c) => { acc[c.type] = (acc[c.type] ?? 0) + 1; return acc; }, {});
  const supportingCount = contacts.filter(c => c.status === 'supporting').length;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-4">
        {(Object.entries(CONTACT_TYPE_LABELS) as [ContactType, string][]).map(([type, label]) => (
          typeCounts[type] ? (
            <div key={type} className="text-xs font-mono text-slate-400">
              {label}: <span className="text-white font-bold">{typeCounts[type]}</span>
            </div>
          ) : null
        ))}
        {supportingCount > 0 && (
          <div className="text-xs font-mono text-emerald-400">
            Supporting: <span className="font-bold">{supportingCount}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name, org, constituency…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
        />
        <div className="flex gap-1">
          {(['all', ...Object.keys(CONTACT_TYPE_LABELS)] as (ContactType | 'all')[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              {t === 'all' ? 'All' : CONTACT_TYPE_LABELS[t as ContactType]}
              {t !== 'all' && typeCounts[t] ? ` (${typeCounts[t]})` : ''}
            </button>
          ))}
        </div>
        <AddContactModal onAdd={handleAdd} />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">No contacts — add your first via the button above</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden md:table-cell">Org / Reach</th>
                <th className="text-left px-4 py-3 font-mono text-slate-500 uppercase tracking-wide hidden lg:table-cell">Last contact</th>
                <th className="text-right px-4 py-3 font-mono text-slate-500 uppercase tracking-wide">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 group">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{c.name}</p>
                    {c.notes && <p className="text-[10px] text-slate-600 truncate max-w-[180px] mt-0.5">{c.notes}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-400">
                      {CONTACT_TYPE_LABELS[c.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-400">
                    {c.type === 'influencer' && c.followers_count
                      ? <span>{c.platform && <span className="text-slate-600">{c.platform} · </span>}{fmtFollowers(c.followers_count)}</span>
                      : c.type === 'mp' && c.constituency
                      ? <span className="text-slate-500">{c.constituency}</span>
                      : <span className="text-slate-600">{c.organisation ?? '—'}</span>
                    }
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600 font-mono">
                    {fmtDate(c.contacted_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusDropdown contactId={c.id} current={c.status} onUpdate={handleStatusUpdate} />
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={isPending}
                      className="text-slate-800 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Press tab ─────────────────────────────────────────────────────────────────

function PressTab({ press: initial }: { press: PressLink[] }) {
  const [press, setPress] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function handleAdd(p: PressLink) { setPress(prev => [p, ...prev]); }

  function handleDelete(id: string) {
    startTransition(async () => {
      await api('delete_press', { id });
      setPress(prev => prev.filter(p => p.id !== id));
    });
  }

  const positive = press.filter(p => p.sentiment === 'positive').length;
  const negative = press.filter(p => p.sentiment === 'negative').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs font-mono text-slate-400">
          {press.length > 0 && <>
            <span>Total: <span className="text-white font-bold">{press.length}</span></span>
            {positive > 0 && <span className="text-emerald-400">Positive: <span className="font-bold">{positive}</span></span>}
            {negative > 0 && <span className="text-red-400">Negative: <span className="font-bold">{negative}</span></span>}
          </>}
        </div>
        <AddPressModal onAdd={handleAdd} />
      </div>

      {press.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">No press mentions logged yet</p>
      ) : (
        <div className="space-y-3">
          {press.map(p => {
            const sc = SENTIMENT_CONFIG[p.sentiment];
            return (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 flex items-start gap-4 group">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-500 font-semibold">{p.publication}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${sc.color}`}>{sc.label}</span>
                    <span className="text-[10px] text-slate-600 font-mono ml-auto">{fmtDate(p.published_date)}</span>
                  </div>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-indigo-400 transition-colors font-medium leading-relaxed">
                      {p.title} ↗
                    </a>
                  ) : (
                    <p className="text-sm text-white font-medium leading-relaxed">{p.title}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  disabled={isPending}
                  className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40 shrink-0"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────

type Tab = 'milestones' | 'contacts' | 'press';

export function CampaignBoard({ initialMilestones, initialContacts, initialPress }: Props) {
  const [tab, setTab] = useState<Tab>('milestones');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'milestones', label: 'Milestones', count: initialMilestones.length },
    { id: 'contacts',   label: 'Contacts',   count: initialContacts.length },
    { id: 'press',      label: 'Press',      count: initialPress.length },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-mono rounded-t-lg transition-colors flex items-center gap-2 -mb-px border-b-2 ${
              tab === t.id
                ? 'border-indigo-500 text-white bg-slate-800/50'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${tab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'milestones' && <MilestonesTab milestones={initialMilestones} />}
      {tab === 'contacts'   && <ContactsTab contacts={initialContacts} />}
      {tab === 'press'      && <PressTab press={initialPress} />}
    </div>
  );
}
