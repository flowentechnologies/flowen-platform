'use client';

import React, { useState, useCallback } from 'react';
import type { WaitlistSignup } from '@/app/api/admin/waitlist/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    // future date (e.g. expires_at)
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `in ${days}d`;
  }
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function isExpiringSoon(iso: string): boolean {
  return new Date(iso).getTime() - Date.now() < 24 * 60 * 60 * 1000;
}

type FilterTab = 'all' | 'not_invited' | 'invited' | 'expired' | 'converted';

const STATUS_BADGE: Record<WaitlistSignup['status'], string> = {
  not_invited: 'bg-slate-100 dark:bg-slate-800 text-slate-400',
  invited: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  expired: 'bg-red-500/10 text-red-400 border border-red-500/20',
  converted: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
};

const STATUS_LABEL: Record<WaitlistSignup['status'], string> = {
  not_invited: 'Not invited',
  invited: 'Invited',
  expired: 'Expired',
  converted: 'Converted',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function WaitlistClient({ initialSignups }: { initialSignups: WaitlistSignup[] }) {
  const [signups, setSignups] = useState<WaitlistSignup[]>(initialSignups);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [globalLoading, setGlobalLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const refetch = useCallback(async () => {
    const res = await fetch('/api/admin/waitlist');
    if (res.ok) {
      const json = (await res.json()) as { signups: WaitlistSignup[] };
      setSignups(json.signups);
      setSelected(new Set());
    }
  }, []);

  const markLoading = (id: string, on: boolean) => {
    setLoading((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function inviteIds(ids: string[]) {
    setGlobalLoading(true);
    ids.forEach((id) => markLoading(id, true));
    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', ids }),
      });
      const json = (await res.json()) as { sent: number; errors: string[] };
      if (json.errors.length > 0) {
        showToast(`Sent ${json.sent}, ${json.errors.length} error(s)`, false);
      } else {
        showToast(`Invitation${json.sent !== 1 ? 's' : ''} sent to ${json.sent} contact${json.sent !== 1 ? 's' : ''}`, true);
      }
      await refetch();
    } catch {
      showToast('Network error', false);
    } finally {
      ids.forEach((id) => markLoading(id, false));
      setGlobalLoading(false);
    }
  }

  async function revokeId(id: string) {
    markLoading(id, true);
    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', id }),
      });
      if (res.ok) {
        showToast('Invitation revoked', true);
        await refetch();
      } else {
        showToast('Failed to revoke', false);
      }
    } catch {
      showToast('Network error', false);
    } finally {
      markLoading(id, false);
    }
  }

  async function deleteId(id: string) {
    markLoading(id, true);
    setDeleteConfirm(null);
    try {
      const res = await fetch('/api/admin/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (res.ok) {
        showToast('Entry deleted', true);
        await refetch();
      } else {
        showToast('Failed to delete', false);
      }
    } catch {
      showToast('Network error', false);
    } finally {
      markLoading(id, false);
    }
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const total = signups.length;
  const invitedCount = signups.filter((s) => s.status === 'invited').length;
  const convertedCount = signups.filter((s) => s.status === 'converted').length;
  const conversionRate = total > 0 ? ((convertedCount / total) * 100).toFixed(1) : '0.0';

  const filtered = filter === 'all' ? signups : signups.filter((s) => s.status === filter);

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));
  const someSelected = selected.size > 0;

  const uninvitedIds = signups
    .filter((s) => s.status === 'not_invited')
    .map((s) => s.id);

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'not_invited', label: 'Not Invited' },
    { key: 'invited', label: 'Invited' },
    { key: 'expired', label: 'Expired' },
    { key: 'converted', label: 'Converted' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
            toast.ok
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-red-500/10 text-red-300 border-red-500/20'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Waitlist</h1>
        <p className="text-slate-500 text-sm mt-1">Manage signups and send invitations</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Signups" value={total} />
        <KpiCard label="Invited" value={invitedCount} />
        <KpiCard label="Converted" value={convertedCount} />
        <KpiCard label="Conversion Rate" value={`${conversionRate}%`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter tabs */}
        <div className="flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 gap-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === tab.key
                  ? 'bg-slate-700 text-slate-900 dark:text-white'
                  : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Invite selected */}
        <button
          disabled={!someSelected || globalLoading}
          onClick={() => inviteIds(Array.from(selected))}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-colors bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Invite Selected {someSelected ? `(${selected.size})` : ''}
        </button>

        {/* Invite all uninvited */}
        <button
          disabled={uninvitedIds.length === 0 || globalLoading}
          onClick={() => inviteIds(uninvitedIds)}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-colors bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Invite All Uninvited {uninvitedIds.length > 0 ? `(${uninvitedIds.length})` : ''}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 text-sm">No signups found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      className="rounded border-slate-700 bg-slate-100 dark:bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Invited
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Converted
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((signup) => {
                  const isLoading = loading.has(signup.id);
                  const isSelected = selected.has(signup.id);
                  const isDelConfirm = deleteConfirm === signup.id;

                  return (
                    <tr
                      key={signup.id}
                      className={`transition-colors ${isSelected ? 'bg-slate-800/30' : 'hover:bg-slate-800/20'}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(signup.id)}
                          className="rounded border-slate-700 bg-slate-100 dark:bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                        />
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-medium text-xs">
                        {signup.email}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-700">
                          {signup.source || '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[signup.status]}`}>
                          {STATUS_LABEL[signup.status]}
                        </span>
                      </td>

                      {/* Invited */}
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {signup.invited_at ? relativeTime(signup.invited_at) : '—'}
                      </td>

                      {/* Expires */}
                      <td className="px-4 py-3 text-xs">
                        {signup.invite_expires_at ? (
                          <span
                            className={
                              isExpiringSoon(signup.invite_expires_at) && signup.status === 'invited'
                                ? 'text-red-400'
                                : 'text-slate-400'
                            }
                          >
                            {relativeTime(signup.invite_expires_at)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Converted */}
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {signup.converted_at ? relativeTime(signup.converted_at) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {(signup.status === 'not_invited' || signup.status === 'expired') && (
                            <button
                              disabled={isLoading}
                              onClick={() => inviteIds([signup.id])}
                              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {isLoading ? 'Sending…' : 'Invite'}
                            </button>
                          )}

                          {signup.status === 'invited' && (
                            <button
                              disabled={isLoading}
                              onClick={() => revokeId(signup.id)}
                              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {isLoading ? 'Revoking…' : 'Revoke'}
                            </button>
                          )}

                          {isDelConfirm ? (
                            <>
                              <button
                                onClick={() => deleteId(signup.id)}
                                className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              disabled={isLoading}
                              onClick={() => setDeleteConfirm(signup.id)}
                              className="text-slate-600 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              aria-label="Delete"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
