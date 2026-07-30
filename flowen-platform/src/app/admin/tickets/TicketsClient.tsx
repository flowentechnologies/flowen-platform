'use client';

import React, { useState, useTransition, useRef, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TicketStatus   = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
type TicketCategory = 'general' | 'billing' | 'technical' | 'clinical' | 'account' | 'bug';

interface Message {
  id: string;
  ticket_id: string;
  from_admin: boolean;
  author: string;
  body: string;
  created_at: string;
}

interface Ticket {
  id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  user_email: string;
  user_name: string | null;
  assigned_to: string | null;
  internal_notes: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_due_at: string;
  created_at: string;
  messages: Message[];
}

interface Props {
  initialTickets: Ticket[];
  adminEmail: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; dot: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-500/10 text-red-400',    dot: 'bg-red-400 animate-pulse' },
  high:   { label: 'High',   color: 'bg-orange-500/10 text-orange-400', dot: 'bg-orange-400' },
  normal: { label: 'Normal', color: 'bg-slate-700 text-slate-400',   dot: 'bg-slate-500' },
  low:    { label: 'Low',    color: 'bg-slate-800 text-slate-500',   dot: 'bg-slate-700' },
};

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-500/10 text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-indigo-500/10 text-indigo-400' },
  waiting:     { label: 'Waiting',     color: 'bg-amber-500/10 text-amber-400' },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-500/10 text-emerald-400' },
  closed:      { label: 'Closed',      color: 'bg-slate-700 text-slate-500' },
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  general:   'General',
  billing:   'Billing',
  technical: 'Technical',
  clinical:  'Clinical',
  account:   'Account',
  bug:       'Bug',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  return `${days}d ago`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function slaStatus(ticket: Ticket): 'ok' | 'warning' | 'breached' {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return 'ok';
  const due  = new Date(ticket.sla_due_at).getTime();
  const now  = Date.now();
  const diff = due - now;
  if (diff < 0)                  return 'breached';
  if (diff < 2 * 3_600_000)     return 'warning'; // < 2h remaining
  return 'ok';
}

function slaLabel(ticket: Ticket) {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return null;
  const due  = new Date(ticket.sla_due_at).getTime();
  const now  = Date.now();
  const diff = due - now;
  if (diff < 0) {
    const over = Math.floor(-diff / 3_600_000);
    return `${over}h overdue`;
  }
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  return d > 0 ? `${d}d left` : `${h}h left`;
}

async function api(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── Create ticket modal ───────────────────────────────────────────────────────

function CreateTicketModal({ onCreated }: { onCreated: (t: Ticket) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    subject: '', message: '', user_email: '', user_name: '',
    priority: 'normal' as TicketPriority, category: 'general' as TicketCategory,
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.subject || !form.message || !form.user_email) { setError('Subject, message, and email are required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await api('create_ticket', form);
      if (res.error) { setError(res.error); return; }
      onCreated(res.data);
      setOpen(false);
      setForm({ subject: '', message: '', user_email: '', user_name: '', priority: 'normal', category: 'general' });
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        + New Ticket
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Create Support Ticket</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">User Email *</label>
                  <input value={form.user_email} onChange={e => field('user_email', e.target.value)} placeholder="user@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Name</label>
                  <input value={form.user_name} onChange={e => field('user_name', e.target.value)} placeholder="Full name"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Subject *</label>
                <input value={form.subject} onChange={e => field('subject', e.target.value)} placeholder="Brief description of the issue"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Priority</label>
                  <select value={form.priority} onChange={e => field('priority', e.target.value as TicketPriority)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                    {(Object.entries(PRIORITY_CONFIG) as [TicketPriority, { label: string }][]).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Category</label>
                  <select value={form.category} onChange={e => field('category', e.target.value as TicketCategory)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                    {(Object.entries(CATEGORY_LABELS) as [TicketCategory, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Message *</label>
                <textarea value={form.message} onChange={e => field('message', e.target.value)} rows={5}
                  placeholder="Full description of the issue…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>
              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={submit} disabled={isPending}
                className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                {isPending ? 'Creating…' : 'Create Ticket'}
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Ticket drawer ─────────────────────────────────────────────────────────────

function TicketDrawer({ ticket, adminEmail, onUpdate, onClose }: {
  ticket: Ticket;
  adminEmail: string;
  onUpdate: (id: string, patch: Partial<Ticket> & { newMessage?: Message }) => void;
  onClose: () => void;
}) {
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState(ticket.internal_notes ?? '');
  const [notesEditing, setNotesEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [ticket.messages.length]);

  function updateField(field: string, value: string) {
    startTransition(async () => {
      await api('update_ticket', { id: ticket.id, [field]: value });
      onUpdate(ticket.id, { [field]: value } as Partial<Ticket>);
    });
  }

  function sendReply() {
    if (!reply.trim()) return;
    const body = reply.trim();
    setReply('');
    startTransition(async () => {
      const res = await api('add_message', { ticket_id: ticket.id, body, from_admin: true, author: adminEmail });
      if (res.data) {
        onUpdate(ticket.id, {
          status: ticket.status === 'open' ? 'in_progress' : ticket.status,
          first_response_at: ticket.first_response_at ?? new Date().toISOString(),
          newMessage: res.data,
        });
      }
    });
  }

  function saveNotes() {
    startTransition(async () => {
      await api('update_ticket', { id: ticket.id, internal_notes: notes });
      onUpdate(ticket.id, { internal_notes: notes });
      setNotesEditing(false);
    });
  }

  const sla = slaStatus(ticket);
  const slaLbl = slaLabel(ticket);
  const priorityCfg = PRIORITY_CONFIG[ticket.priority];
  const statusCfg   = STATUS_CONFIG[ticket.status];

  return (
    <div className="fixed inset-0 z-40 flex items-stretch">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${priorityCfg.dot}`} />
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${priorityCfg.color}`}>{priorityCfg.label}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${statusCfg.color}`}>{statusCfg.label}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-400">{CATEGORY_LABELS[ticket.category]}</span>
              {slaLbl && <span className={`text-[10px] font-mono ${sla === 'breached' ? 'text-red-400' : sla === 'warning' ? 'text-amber-400' : 'text-slate-600'}`}>{slaLbl}</span>}
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{ticket.subject}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {ticket.user_name && <span className="text-slate-400">{ticket.user_name} · </span>}
              {ticket.user_email} · {timeAgo(ticket.created_at)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-xl shrink-0 mt-0.5">×</button>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-mono text-slate-600 uppercase tracking-wide">Status</label>
            <select value={ticket.status} onChange={e => updateField('status', e.target.value)} disabled={isPending}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-slate-500 disabled:opacity-40">
              {(Object.entries(STATUS_CONFIG) as [TicketStatus, { label: string }][]).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-mono text-slate-600 uppercase tracking-wide">Priority</label>
            <select value={ticket.priority} onChange={e => updateField('priority', e.target.value)} disabled={isPending}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-slate-500 disabled:opacity-40">
              {(Object.entries(PRIORITY_CONFIG) as [TicketPriority, { label: string }][]).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-mono text-slate-600 uppercase tracking-wide">Category</label>
            <select value={ticket.category} onChange={e => updateField('category', e.target.value)} disabled={isPending}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-slate-500 disabled:opacity-40">
              {(Object.entries(CATEGORY_LABELS) as [TicketCategory, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Original message */}
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
              {(ticket.user_name ?? ticket.user_email)[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-mono text-slate-500 mb-1.5">
                {ticket.user_name ?? ticket.user_email} · {fmtTime(ticket.created_at)}
              </p>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {ticket.body}
              </div>
            </div>
          </div>

          {/* Message thread */}
          {ticket.messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.from_admin ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${msg.from_admin ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {msg.from_admin ? 'F' : msg.author[0].toUpperCase()}
              </div>
              <div className={`flex-1 ${msg.from_admin ? 'items-end' : ''}`}>
                <p className={`text-[11px] font-mono text-slate-500 mb-1.5 ${msg.from_admin ? 'text-right' : ''}`}>
                  {msg.author} · {fmtTime(msg.created_at)}
                </p>
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${msg.from_admin ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' : 'bg-slate-900 border border-slate-800 text-slate-300'}`}>
                  {msg.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Internal notes */}
        <div className="px-6 py-3 border-t border-slate-800">
          {notesEditing ? (
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-amber-400 uppercase tracking-wide">Internal Notes (not visible to user)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full bg-slate-900 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none resize-none" />
              <div className="flex gap-2">
                <button type="button" onClick={saveNotes} disabled={isPending}
                  className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-40">
                  Save Notes
                </button>
                <button type="button" onClick={() => { setNotesEditing(false); setNotes(ticket.internal_notes ?? ''); }}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setNotesEditing(true)}
              className="text-[10px] font-mono text-slate-600 hover:text-amber-400 transition-colors">
              {ticket.internal_notes ? `📝 ${ticket.internal_notes.slice(0, 80)}${ticket.internal_notes.length > 80 ? '…' : ''}` : '+ Add internal note'}
            </button>
          )}
        </div>

        {/* Reply box */}
        {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
          <div className="px-6 py-4 border-t border-slate-800">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
              rows={3}
              placeholder="Reply to user… (Cmd+Enter to send)"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none"
            />
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={sendReply} disabled={!reply.trim() || isPending}
                className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                {isPending ? 'Sending…' : 'Send Reply'}
              </button>
              <button type="button" onClick={() => updateField('status', 'resolved')} disabled={isPending}
                className="px-4 py-2 text-sm font-mono rounded-xl border border-emerald-700/50 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40">
                Mark Resolved
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ticket row ────────────────────────────────────────────────────────────────

function TicketRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  const priorityCfg = PRIORITY_CONFIG[ticket.priority];
  const statusCfg   = STATUS_CONFIG[ticket.status];
  const sla         = slaStatus(ticket);
  const slaLbl      = slaLabel(ticket);

  return (
    <tr
      className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3 w-2">
        <div className={`w-2 h-2 rounded-full ${priorityCfg.dot}`} />
      </td>
      <td className="px-3 py-3">
        <p className="text-sm font-medium text-white truncate max-w-[260px]">{ticket.subject}</p>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
          {ticket.user_name ?? ticket.user_email} · {ticket.messages.length} {ticket.messages.length === 1 ? 'reply' : 'replies'}
        </p>
      </td>
      <td className="px-3 py-3 hidden sm:table-cell">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${statusCfg.color}`}>{statusCfg.label}</span>
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-400">{CATEGORY_LABELS[ticket.category]}</span>
      </td>
      <td className="px-3 py-3 hidden lg:table-cell">
        {slaLbl && (
          <span className={`text-[10px] font-mono ${sla === 'breached' ? 'text-red-400 font-bold' : sla === 'warning' ? 'text-amber-400' : 'text-slate-600'}`}>
            {slaLbl}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-[10px] text-slate-600 font-mono whitespace-nowrap">
        {timeAgo(ticket.created_at)}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const STATUS_TABS: { id: TicketStatus | 'all'; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'open',       label: 'Open' },
  { id: 'in_progress',label: 'In Progress' },
  { id: 'waiting',    label: 'Waiting' },
  { id: 'resolved',   label: 'Resolved' },
];

export function TicketsClient({ initialTickets, adminEmail }: Props) {
  const [tickets, setTickets] = useState(initialTickets);
  const [tab, setTab] = useState<TicketStatus | 'all'>('open');
  const [open, setOpen] = useState<Ticket | null>(null);

  function handleCreated(t: Ticket) { setTickets(prev => [t, ...prev]); }

  function handleUpdate(id: string, patch: Partial<Ticket> & { newMessage?: Message }) {
    setTickets(prev => prev.map(t => {
      if (t.id !== id) return t;
      const { newMessage, ...rest } = patch;
      return {
        ...t,
        ...rest,
        messages: newMessage ? [...t.messages, newMessage] : t.messages,
      };
    }));
    // Update the open drawer ticket too
    setOpen(prev => {
      if (!prev || prev.id !== id) return prev;
      const { newMessage, ...rest } = patch;
      return { ...prev, ...rest, messages: newMessage ? [...prev.messages, newMessage] : prev.messages };
    });
  }

  const filtered = tab === 'all' ? tickets : tickets.filter(t => t.status === tab);
  const counts = STATUS_TABS.reduce<Record<string, number>>((a, t) => {
    a[t.id] = t.id === 'all' ? tickets.length : tickets.filter(tk => tk.status === t.id).length;
    return a;
  }, {});

  const breached = tickets.filter(t => slaStatus(t) === 'breached').length;

  return (
    <div>
      {/* SLA breach banner */}
      {breached > 0 && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
          <p className="text-sm text-red-400 font-mono">
            <span className="font-bold">{breached}</span> ticket{breached !== 1 ? 's' : ''} have breached SLA
          </p>
        </div>
      )}

      {/* Tabs + create */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {STATUS_TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
              {t.label} {counts[t.id] > 0 ? `(${counts[t.id]})` : ''}
            </button>
          ))}
        </div>
        <CreateTicketModal onCreated={handleCreated} />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">
          No {tab === 'all' ? '' : tab.replace('_', ' ')} tickets
        </p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="w-2 px-4 py-3" />
                <th className="text-left px-3 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="text-left px-3 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="text-left px-3 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                <th className="text-left px-3 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide hidden lg:table-cell">SLA</th>
                <th className="text-right px-4 py-3 text-[10px] font-mono text-slate-500 uppercase tracking-wide">Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <TicketRow key={t.id} ticket={t} onClick={() => setOpen(t)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <TicketDrawer
          ticket={open}
          adminEmail={adminEmail}
          onUpdate={handleUpdate}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
