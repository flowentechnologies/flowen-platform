'use client';

import React, { useState, useTransition } from 'react';
import type { DeckInvite } from '@/app/api/admin/pitch-deck/route';

interface RecentView { invite_id: string; viewed_at: string; }

interface Props {
  initialInvites: DeckInvite[];
  recentViews: RecentView[];
  siteUrl: string;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy}
      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${copied ? 'border-emerald-500/50 text-emerald-400' : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'}`}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function StatusBadge({ invite }: { invite: DeckInvite }) {
  const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
  if (invite.revoked) return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30">Revoked</span>;
  if (expired)        return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-700 text-slate-500 border border-slate-300 dark:border-slate-700">Expired</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">Active</span>;
}

function CreateInvitePanel({ siteUrl, onCreated }: { siteUrl: string; onCreated: (invite: DeckInvite) => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ investor_name: '', investor_email: '', firm: '', expires_days: '30' });
  const [newLink, setNewLink] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch('/api/admin/pitch-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...form }),
      });
      const { invite } = await res.json();
      if (invite) {
        onCreated(invite);
        setNewLink(`${siteUrl}/api/pitch/${invite.token}`);
        setForm({ investor_name: '', investor_email: '', firm: '', expires_days: '30' });
      }
    });
  }

  return (
    <div>
      <button type="button" onClick={() => { setOpen(o => !o); setNewLink(null); }}
        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition-colors">
        + New Investor Link
      </button>

      {open && (
        <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 max-w-lg">
          {newLink ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-emerald-400">Link created successfully</p>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 font-mono text-xs text-slate-600 dark:text-slate-300 break-all">{newLink}</div>
              <div className="flex gap-2">
                <CopyButton text={newLink} />
                <button type="button" onClick={() => { setNewLink(null); setOpen(false); }}
                  className="text-[10px] font-mono px-3 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                  Done
                </button>
              </div>
              <p className="text-[10px] text-slate-600 font-mono">This link will not be shown again. Copy it now.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-xs font-bold text-slate-900 dark:text-white mb-3">Create investor access link</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-slate-500 block mb-1">Investor Name *</label>
                  <input required value={form.investor_name} onChange={e => setForm(f => ({ ...f, investor_name: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-500 block mb-1">Firm / Fund</label>
                  <input value={form.firm} onChange={e => setForm(f => ({ ...f, firm: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-500 block mb-1">Email (optional)</label>
                <input type="email" value={form.investor_email} onChange={e => setForm(f => ({ ...f, investor_email: e.target.value }))}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-500 block mb-1">Expires in (days, leave 0 = never)</label>
                <input type="number" min="0" value={form.expires_days} onChange={e => setForm(f => ({ ...f, expires_days: e.target.value }))}
                  className="w-32 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-500 outline-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold disabled:opacity-50 transition-colors">
                  {isPending ? 'Creating…' : 'Generate Link'}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 text-xs hover:text-slate-900 dark:hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export function PitchDeckClient({ initialInvites, recentViews, siteUrl }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [isPending, startTransition] = useTransition();

  const viewsByInvite = recentViews.reduce<Record<string, string[]>>((acc, v) => {
    (acc[v.invite_id] ??= []).push(v.viewed_at);
    return acc;
  }, {});

  const totalViews     = invites.reduce((s, i) => s + (i.view_count ?? 0), 0);
  const activeLinks    = invites.filter(i => !i.revoked && (!i.expires_at || new Date(i.expires_at) > new Date())).length;
  const uniqueViewers  = new Set(recentViews.map(v => v.invite_id)).size;

  function handleRevoke(id: string) {
    startTransition(async () => {
      await fetch('/api/admin/pitch-deck', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', id }),
      });
      setInvites(prev => prev.map(i => i.id === id ? { ...i, revoked: true } : i));
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this link and all its view data?')) return;
    startTransition(async () => {
      await fetch('/api/admin/pitch-deck', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      setInvites(prev => prev.filter(i => i.id !== id));
    });
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Pitch Deck</h1>
          <p className="text-slate-500 text-xs font-mono mt-1">Investor-tracked access links for the interactive pitch canvas</p>
        </div>
        <CreateInvitePanel siteUrl={siteUrl} onCreated={inv => setInvites(prev => [inv, ...prev])} />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Views', value: totalViews.toString(), color: 'text-slate-900 dark:text-white' },
          { label: 'Active Links', value: activeLinks.toString(), color: 'text-emerald-400' },
          { label: 'Unique Viewers', value: uniqueViewers.toString(), color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-amber-500/20 rounded-2xl px-5 py-4">
        <p className="text-xs font-bold text-amber-400 mb-1">How investor links work</p>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Each link is unique to one investor — share it by email or message. When they open it, their view is logged with a timestamp. Links can be set to expire or revoked at any time. The deck is served from <code className="text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 rounded">/api/pitch/[token]</code> — the HTML is never publicly indexed.
        </p>
      </div>

      {/* Links table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900 dark:text-white">Investor Links ({invites.length})</p>
          {isPending && <span className="text-[10px] font-mono text-slate-600 animate-pulse">Updating…</span>}
        </div>

        {invites.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-slate-500 text-sm">No links yet</p>
            <p className="text-slate-700 text-xs font-mono mt-1">Create your first investor link above</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {invites.map(invite => {
              const linkUrl = `${siteUrl}/api/pitch/${invite.token}`;
              const views = viewsByInvite[invite.id] ?? [];
              const isActive = !invite.revoked && (!invite.expires_at || new Date(invite.expires_at) > new Date());

              return (
                <div key={invite.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Investor info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{invite.investor_name}</span>
                      {invite.firm && <span className="text-[10px] font-mono text-slate-500">{invite.firm}</span>}
                      <StatusBadge invite={invite} />
                    </div>
                    {invite.investor_email && (
                      <p className="text-[10px] font-mono text-slate-600 mt-0.5">{invite.investor_email}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-600 truncate max-w-xs">{linkUrl}</span>
                      <CopyButton text={linkUrl} />
                    </div>
                  </div>

                  {/* View stats */}
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className={`text-xl font-black ${invite.view_count > 0 ? 'text-amber-400' : 'text-slate-700'}`}>
                        {invite.view_count ?? 0}
                      </p>
                      <p className="text-[9px] font-mono text-slate-600">views</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-slate-500">
                        {invite.last_viewed_at ? timeAgo(invite.last_viewed_at) : 'Never viewed'}
                      </p>
                      <p className="text-[9px] font-mono text-slate-700">
                        Created {fmtDate(invite.created_at)}
                        {invite.expires_at ? ` · Expires ${fmtDate(invite.expires_at)}` : ''}
                      </p>
                    </div>

                    {/* View timeline mini */}
                    {views.length > 0 && (
                      <div className="flex flex-col gap-0.5 max-h-12 overflow-hidden">
                        {views.slice(0, 5).map((v, i) => (
                          <span key={i} className="text-[8px] font-mono text-slate-700 whitespace-nowrap">{timeAgo(v)}</span>
                        ))}
                        {views.length > 5 && <span className="text-[8px] font-mono text-slate-800">+{views.length - 5} more</span>}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <button type="button" onClick={() => handleRevoke(invite.id)}
                          className="text-[10px] font-mono px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-amber-500 hover:text-amber-400 hover:border-amber-500/50 transition-colors">
                          Revoke
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(invite.id)}
                        className="text-[10px] font-mono px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-red-500/60 hover:text-red-400 hover:border-red-500/50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Deck status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Deck Asset</p>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400 font-mono">deck.html</span>
          <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">Ready</span>
        </div>
        <p className="text-[10px] font-mono text-slate-600 mt-2">
          Interactive 11-slide investor canvas · ASR latency demo · TAM/ARR calculator · Served at <code className="text-slate-500">/api/pitch/[token]</code>
        </p>
      </div>

    </div>
  );
}
