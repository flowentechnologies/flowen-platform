'use client';

import React, { useState, useTransition } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffRole    = 'owner' | 'admin' | 'developer' | 'support' | 'analyst' | 'clinical' | 'marketing';
type StaffStatus  = 'active' | 'inactive' | 'suspended';
type ShiftPeriod  = 'morning' | 'afternoon' | 'evening' | 'night';

interface Member {
  id: string;
  email: string | null;
  display_name: string | null;
  last_sign_in_at: string | null;
  profile_created: string;
  role: StaffRole;
  department: string | null;
  title: string | null;
  bio: string | null;
  status: StaffStatus;
  joined_at: string;
}

interface Invite {
  id: string;
  email: string;
  role: StaffRole;
  department: string | null;
  token: string;
  invited_by_email: string;
  expires_at: string;
  accepted_at: string | null;
  revoked: boolean;
  created_at: string;
}

interface Handoff {
  id: string;
  author_email: string;
  author_name: string | null;
  shift: ShiftPeriod;
  summary: string;
  action_items: string | null;
  flags: string[] | null;
  created_at: string;
}

interface Props {
  initialMembers:  Member[];
  initialInvites:  Invite[];
  initialHandoffs: Handoff[];
  adminEmail:      string;
  siteUrl:         string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<StaffRole, { label: string; color: string; perms: string }> = {
  owner:     { label: 'Owner',     color: 'bg-purple-500/10 text-purple-400',  perms: 'Full access + billing' },
  admin:     { label: 'Admin',     color: 'bg-indigo-500/10 text-indigo-400',  perms: 'Full admin panel' },
  developer: { label: 'Developer', color: 'bg-blue-500/10 text-blue-400',      perms: 'System + technical' },
  support:   { label: 'Support',   color: 'bg-amber-500/10 text-amber-400',    perms: 'Tickets + users' },
  analyst:   { label: 'Analyst',   color: 'bg-emerald-500/10 text-emerald-400',perms: 'Analytics + billing read' },
  clinical:  { label: 'Clinical',  color: 'bg-pink-500/10 text-pink-400',      perms: 'Clinical data only' },
  marketing: { label: 'Marketing', color: 'bg-orange-500/10 text-orange-400',  perms: 'Content + campaign' },
};

const STATUS_CONFIG: Record<StaffStatus, { label: string; dot: string }> = {
  active:    { label: 'Active',    dot: 'bg-emerald-400' },
  inactive:  { label: 'Inactive',  dot: 'bg-slate-500' },
  suspended: { label: 'Suspended', dot: 'bg-red-400' },
};

const SHIFT_CONFIG: Record<ShiftPeriod, { label: string; color: string; hours: string }> = {
  morning:   { label: 'Morning',   color: 'bg-amber-500/10 text-amber-400',    hours: '06:00–14:00' },
  afternoon: { label: 'Afternoon', color: 'bg-blue-500/10 text-blue-400',      hours: '14:00–22:00' },
  evening:   { label: 'Evening',   color: 'bg-indigo-500/10 text-indigo-400',  hours: '18:00–02:00' },
  night:     { label: 'Night',     color: 'bg-slate-700 text-slate-400',       hours: '22:00–06:00' },
};

const FLAG_COLORS: Record<string, string> = {
  urgent:    'bg-red-500/10 text-red-400',
  billing:   'bg-emerald-500/10 text-emerald-400',
  technical: 'bg-blue-500/10 text-blue-400',
  clinical:  'bg-pink-500/10 text-pink-400',
  security:  'bg-orange-500/10 text-orange-400',
  escalated: 'bg-purple-500/10 text-purple-400',
};

const ALL_FLAGS = Object.keys(FLAG_COLORS);

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(member: Member) {
  const name = member.display_name ?? member.email ?? '?';
  return name.split(/[\s@]/)[0].slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30)  return `${days}d ago`;
  return fmtDate(iso);
}

function isExpired(iso: string) { return new Date(iso) < new Date(); }

async function api(action: string, payload: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.json();
}

// ── Edit member modal ─────────────────────────────────────────────────────────

function EditMemberModal({ member, onSave }: { member: Member; onSave: (patch: Partial<Member>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ role: member.role, department: member.department ?? '', title: member.title ?? '', bio: member.bio ?? '' });
  const [isPending, startTransition] = useTransition();

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function save() {
    startTransition(async () => {
      await api('upsert_member_meta', { id: member.id, ...form, status: member.status });
      onSave({ role: form.role as StaffRole, department: form.department || null, title: form.title || null, bio: form.bio || null });
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors">
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">{member.display_name ?? member.email}</h3>
                <p className="text-[11px] text-slate-500 font-mono">{member.email}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Role</label>
                <select value={form.role} onChange={e => field('role', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60">
                  {(Object.entries(ROLE_CONFIG) as [StaffRole, { label: string; perms: string }][]).map(([v, c]) => (
                    <option key={v} value={v}>{c.label} — {c.perms}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Department</label>
                  <input value={form.department} onChange={e => field('department', e.target.value)} placeholder="Engineering, Clinical…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Title</label>
                  <input value={form.title} onChange={e => field('title', e.target.value)} placeholder="CTO, Lead Dev…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Bio / Notes</label>
                <textarea value={form.bio} onChange={e => field('bio', e.target.value)} rows={2}
                  placeholder="Short bio or internal notes…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button type="button" onClick={save} disabled={isPending}
                className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                {isPending ? 'Saving…' : 'Save'}
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

// ── Team tab ──────────────────────────────────────────────────────────────────

function TeamTab({ members: initial, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [members, setMembers] = useState(initial);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(id: string, patch: Partial<Member>) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  function revokeAdmin(id: string) {
    if (id === currentUserId) return; // can't self-revoke
    setRevoking(id);
    startTransition(async () => {
      await api('revoke_admin', { id });
      setMembers(prev => prev.filter(m => m.id !== id));
      setRevoking(null);
    });
  }

  return (
    <div className="space-y-3">
      {members.map(m => {
        const roleCfg   = ROLE_CONFIG[m.role];
        const statusCfg = STATUS_CONFIG[m.status];
        const isSelf    = m.id === currentUserId;

        return (
          <div key={m.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-5 py-4 flex items-center gap-4 transition-colors group">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials(m)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-white">
                  {m.display_name ?? m.email}
                  {isSelf && <span className="ml-1.5 text-[10px] font-mono text-slate-600">(you)</span>}
                </p>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${roleCfg.color}`}>{roleCfg.label}</span>
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                  <span className="text-[10px] font-mono text-slate-500">{statusCfg.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {m.display_name ? m.email : null}
                {m.title && <span className="text-slate-600"> · {m.title}</span>}
                {m.department && <span className="text-slate-600"> · {m.department}</span>}
              </p>
              <p className="text-[10px] text-slate-700 font-mono mt-0.5">
                Last active: {timeAgo(m.last_sign_in_at)} · Joined {fmtDate(m.joined_at)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <EditMemberModal member={m} onSave={patch => handleSave(m.id, patch)} />
              {!isSelf && (
                <button type="button"
                  onClick={() => revoking === m.id ? revokeAdmin(m.id) : setRevoking(m.id)}
                  disabled={isPending}
                  className={`px-2.5 py-1.5 text-[11px] font-mono rounded-lg border transition-colors disabled:opacity-40 ${
                    revoking === m.id
                      ? 'border-red-700/50 bg-red-500/10 text-red-400'
                      : 'border-slate-700 text-slate-600 hover:text-red-400 hover:border-red-800/50'
                  }`}>
                  {revoking === m.id ? 'Confirm remove' : 'Remove'}
                </button>
              )}
              {revoking === m.id && (
                <button type="button" onClick={() => setRevoking(null)}
                  className="px-2 py-1.5 text-[11px] font-mono text-slate-500 hover:text-white transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ adminEmail, onCreated }: { adminEmail: string; onCreated: (inv: Invite, url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'admin' as StaffRole, department: '' });
  const [result, setResult] = useState<{ invite: Invite; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.email) { setError('Email is required'); return; }
    setError(null);
    startTransition(async () => {
      const res = await api('create_invite', { ...form, invited_by_email: adminEmail });
      if (res.error) { setError(res.error); return; }
      setResult({ invite: res.data, url: res.inviteUrl });
      onCreated(res.data, res.inviteUrl);
    });
  }

  function close() { setOpen(false); setResult(null); setError(null); setForm({ email: '', role: 'admin', department: '' }); }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
        + Invite Staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">{result ? 'Invite Created' : 'Invite Team Member'}</h3>
              <button type="button" onClick={close} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>

            {result ? (
              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-emerald-400 font-mono">
                  Invite created for <strong className="text-white">{result.invite.email}</strong>
                </p>
                <div className="bg-slate-950 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">Invite Link (expires 7 days)</p>
                  <p className="text-xs font-mono text-white break-all">{result.url}</p>
                  <button type="button" onClick={() => navigator.clipboard.writeText(result.url)}
                    className="mt-1 px-3 py-1.5 text-[10px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors">
                    Copy link
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">Role: {ROLE_CONFIG[result.invite.role].label} · {ROLE_CONFIG[result.invite.role].perms}</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Email *</label>
                  <input type="email" value={form.email} onChange={e => field('email', e.target.value)} placeholder="colleague@example.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Role</label>
                  <div className="space-y-2">
                    {(Object.entries(ROLE_CONFIG) as [StaffRole, { label: string; color: string; perms: string }][]).map(([v, c]) => (
                      <label key={v} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.role === v ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-700 hover:border-slate-600'}`}>
                        <input type="radio" name="role" value={v} checked={form.role === v} onChange={() => field('role', v)} className="accent-indigo-500" />
                        <div>
                          <span className={`text-xs font-mono font-bold ${c.color.split(' ')[1]}`}>{c.label}</span>
                          <span className="text-[11px] text-slate-500 ml-2">{c.perms}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Department</label>
                  <input value={form.department} onChange={e => field('department', e.target.value)} placeholder="Engineering, Clinical…"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60" />
                </div>
                {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              {result ? (
                <button type="button" onClick={close}
                  className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors">Done</button>
              ) : (
                <>
                  <button type="button" onClick={submit} disabled={isPending}
                    className="px-5 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
                    {isPending ? 'Creating…' : 'Send Invite'}
                  </button>
                  <button type="button" onClick={close}
                    className="px-4 py-2 text-sm font-mono rounded-xl border border-slate-700 text-slate-400 hover:text-white transition-colors">Cancel</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Invites tab ───────────────────────────────────────────────────────────────

function InvitesTab({ invites: initial, adminEmail }: { invites: Invite[]; adminEmail: string }) {
  const [invites, setInvites] = useState(initial);
  const [copying, setCopying] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreated(inv: Invite) { setInvites(prev => [inv, ...prev]); }

  function copyLink(token: string) {
    const url = `${window.location.origin}/admin/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopying(token);
    setTimeout(() => setCopying(null), 1500);
  }

  function revoke(id: string) {
    startTransition(async () => {
      await api('revoke_invite', { id });
      setInvites(prev => prev.map(i => i.id === id ? { ...i, revoked: true } : i));
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await api('delete_invite', { id });
      setInvites(prev => prev.filter(i => i.id !== id));
    });
  }

  const active   = invites.filter(i => !i.revoked && !i.accepted_at && !isExpired(i.expires_at));
  const inactive = invites.filter(i => i.revoked || i.accepted_at || isExpired(i.expires_at));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-slate-500">{active.length} pending · {invites.filter(i => i.accepted_at).length} accepted</p>
        <InviteModal adminEmail={adminEmail} onCreated={inv => handleCreated(inv)} />
      </div>

      {invites.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">No invites yet</p>
      ) : (
        <div className="space-y-2">
          {[...active, ...inactive].map(inv => {
            const accepted = !!inv.accepted_at;
            const expired  = isExpired(inv.expires_at) && !accepted;
            const inactive_ = inv.revoked || accepted || expired;
            const roleCfg  = ROLE_CONFIG[inv.role];

            return (
              <div key={inv.id} className={`bg-slate-900 border rounded-xl px-5 py-4 flex items-center gap-4 group transition-opacity ${inactive_ ? 'border-slate-800/50 opacity-50' : 'border-slate-800 hover:border-slate-700'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-white">{inv.email}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${roleCfg.color}`}>{roleCfg.label}</span>
                    {accepted && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400">Accepted</span>}
                    {inv.revoked && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-500/10 text-red-400">Revoked</span>}
                    {expired && !inv.revoked && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-700 text-slate-500">Expired</span>}
                  </div>
                  <p className="text-[10px] text-slate-600 font-mono">
                    Invited by {inv.invited_by_email} · Expires {fmtDate(inv.expires_at)}
                    {inv.department && ` · ${inv.department}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!inactive_ && (
                    <button type="button" onClick={() => copyLink(inv.token)}
                      className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors">
                      {copying === inv.token ? 'Copied ✓' : 'Copy link'}
                    </button>
                  )}
                  {!inv.revoked && !accepted && (
                    <button type="button" onClick={() => revoke(inv.id)} disabled={isPending}
                      className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-amber-800/50 text-amber-600 hover:text-amber-400 transition-colors disabled:opacity-40">
                      Revoke
                    </button>
                  )}
                  <button type="button" onClick={() => remove(inv.id)} disabled={isPending}
                    className="text-slate-700 hover:text-red-400 transition-colors disabled:opacity-40 text-sm">×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Handoff tab ───────────────────────────────────────────────────────────────

function HandoffTab({ handoffs: initial, adminEmail, adminName }: { handoffs: Handoff[]; adminEmail: string; adminName: string }) {
  const [handoffs, setHandoffs] = useState(initial);
  const [form, setForm] = useState({ shift: 'morning' as ShiftPeriod, summary: '', action_items: '', flags: [] as string[] });
  const [composing, setComposing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function field(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function toggleFlag(flag: string) {
    setForm(f => ({
      ...f,
      flags: f.flags.includes(flag) ? f.flags.filter(x => x !== flag) : [...f.flags, flag],
    }));
  }

  function submit() {
    if (!form.summary.trim()) return;
    startTransition(async () => {
      const res = await api('create_handoff', {
        author_email: adminEmail, author_name: adminName,
        shift: form.shift, summary: form.summary,
        action_items: form.action_items || null, flags: form.flags,
      });
      if (res.data) {
        setHandoffs(prev => [res.data, ...prev]);
        setForm({ shift: 'morning', summary: '', action_items: '', flags: [] });
        setComposing(false);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await api('delete_handoff', { id });
      setHandoffs(prev => prev.filter(h => h.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-slate-500">Last {handoffs.length} handoffs</p>
        <button type="button" onClick={() => setComposing(v => !v)}
          className="px-4 py-2 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          {composing ? 'Cancel' : '+ Log Handoff'}
        </button>
      </div>

      {/* Compose */}
      {composing && (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.entries(SHIFT_CONFIG) as [ShiftPeriod, { label: string; hours: string; color: string }][]).map(([s, c]) => (
              <button key={s} type="button" onClick={() => field('shift', s)}
                className={`p-3 rounded-xl border text-left transition-colors ${form.shift === s ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                <p className={`text-[10px] font-mono font-bold ${form.shift === s ? 'text-indigo-400' : 'text-slate-500'}`}>{c.label}</p>
                <p className="text-[9px] text-slate-600 font-mono">{c.hours}</p>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Summary *</label>
            <textarea value={form.summary} onChange={e => field('summary', e.target.value)} rows={4}
              placeholder="What happened this shift? Key events, user contacts, incidents, metrics…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none leading-relaxed" />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1.5">Action Items for Next Shift</label>
            <textarea value={form.action_items} onChange={e => field('action_items', e.target.value)} rows={2}
              placeholder="• Follow up on ticket #123&#10;• Check Stripe payment for user@example.com"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none font-mono leading-relaxed" />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Flags</label>
            <div className="flex flex-wrap gap-2">
              {ALL_FLAGS.map(flag => (
                <button key={flag} type="button" onClick={() => toggleFlag(flag)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors ${
                    form.flags.includes(flag) ? FLAG_COLORS[flag] + ' border border-current/30' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                  }`}>
                  {flag}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={submit} disabled={!form.summary.trim() || isPending}
            className="px-5 py-2.5 text-sm font-mono font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40">
            {isPending ? 'Logging…' : 'Log Handoff'}
          </button>
        </div>
      )}

      {/* Log */}
      {handoffs.length === 0 && !composing ? (
        <p className="py-10 text-center text-sm text-slate-600 font-mono">No handoffs logged yet</p>
      ) : (
        <div className="space-y-3">
          {handoffs.map(h => {
            const shiftCfg = SHIFT_CONFIG[h.shift];
            return (
              <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${shiftCfg.color}`}>{shiftCfg.label}</span>
                    {(h.flags ?? []).map(flag => (
                      <span key={flag} className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${FLAG_COLORS[flag] ?? 'bg-slate-800 text-slate-400'}`}>
                        {flag}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-600 font-mono">
                      {h.author_name ?? h.author_email} · {new Date(h.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button type="button" onClick={() => remove(h.id)}
                    className="text-slate-800 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">×</button>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{h.summary}</p>
                {h.action_items && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <p className="text-[10px] font-mono text-amber-400 uppercase tracking-wide mb-1.5">Action Items</p>
                    <p className="text-xs text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">{h.action_items}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Tab = 'team' | 'invites' | 'handoff';

export function StaffClient({ initialMembers, initialInvites, initialHandoffs, adminEmail, siteUrl }: Props) {
  const [tab, setTab] = useState<Tab>('team');

  const currentUserId = initialMembers.find(m => m.email === adminEmail)?.id ?? '';
  const adminName     = initialMembers.find(m => m.email === adminEmail)?.display_name ?? adminEmail;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'team',    label: 'Team',        count: initialMembers.length },
    { id: 'invites', label: 'Invites',     count: initialInvites.filter(i => !i.revoked && !i.accepted_at).length },
    { id: 'handoff', label: 'Handoff Log', count: initialHandoffs.length },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-mono rounded-t-lg transition-colors flex items-center gap-2 -mb-px border-b-2 ${
              tab === t.id ? 'border-indigo-500 text-white bg-slate-800/50' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${tab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'team'    && <TeamTab members={initialMembers} currentUserId={currentUserId} />}
      {tab === 'invites' && <InvitesTab invites={initialInvites} adminEmail={adminEmail} />}
      {tab === 'handoff' && <HandoffTab handoffs={initialHandoffs} adminEmail={adminEmail} adminName={adminName} />}
    </div>
  );
}
