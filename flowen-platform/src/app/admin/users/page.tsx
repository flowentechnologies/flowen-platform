'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import type { AdminUserRecord } from '@/app/api/admin/users/route';
import type { AtRiskUser } from '@/app/api/admin/users/at-risk/route';

type FilterTab = 'all' | 'active' | 'admins' | 'beta' | 'waitlist';

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const colours: Record<string, string> = {
    founding: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    pro: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    free: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
  };
  const cls = colours[tier] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/30';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${cls}`}>
      {tier.toUpperCase()}
    </span>
  );
}

function AdminBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
      ADMIN
    </span>
  );
}

function EarlyAccessBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
      BETA
    </span>
  );
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const src = name ?? email;
  const letters = src
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold font-mono flex-shrink-0">
      {letters || '?'}
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="space-y-1.5">
            <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800 rounded" />
            <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </td>
      <td className="p-4"><div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-10 bg-slate-100 dark:bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-12 bg-slate-100 dark:bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-10 bg-slate-100 dark:bg-slate-800 rounded" /></td>
    </tr>
  );
}

interface DropdownProps {
  user: AdminUserRecord;
  onToggleAdmin: (userId: string) => void;
  onToggleEarlyAccess: (userId: string) => void;
  onResetPassword: (userId: string, email: string) => void;
  loading: boolean;
}

function ActionsDropdown({ user, onToggleAdmin, onToggleEarlyAccess, onResetPassword, loading }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
      >
        Actions
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
          <button
            type="button"
            onClick={() => { onToggleEarlyAccess(user.id); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-xs text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-300 transition-colors"
          >
            {user.early_access ? 'Revoke beta access' : 'Grant beta access'}
          </button>
          <button
            type="button"
            onClick={() => { onToggleAdmin(user.id); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {user.is_admin ? 'Remove admin' : 'Make admin'}
          </button>
          <button
            type="button"
            onClick={() => { onResetPassword(user.id, user.email); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Send password reset
          </button>
          <a
            href={`/admin/users/${user.id}`}
            className="block px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            View profile
          </a>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [atRiskUsers, setAtRiskUsers] = useState<AtRiskUser[]>([]);
  const [atRiskLoading, setAtRiskLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch('/api/admin/users/at-risk')
      .then((r) => r.json())
      .then((data) => {
        if (data.atRiskUsers) setAtRiskUsers(data.atRiskUsers);
      })
      .catch(() => {})
      .finally(() => setAtRiskLoading(false));
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleToggleEarlyAccess(userId: string) {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_early_access', userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, early_access: data.early_access } : u)),
      );
      showToast(data.early_access ? 'Beta access granted' : 'Beta access revoked', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleAdmin(userId: string) {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_admin', userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: data.is_admin } : u)),
      );
      showToast('Admin status updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetPassword(userId: string, email: string) {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      if (data.action_link) {
        await navigator.clipboard.writeText(data.action_link).catch(() => {});
        showToast(`Reset link for ${email} copied to clipboard`, 'success');
      } else {
        showToast(`Password reset sent to ${email}`, 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active Subs' },
    { key: 'admins', label: 'Admins' },
    { key: 'beta', label: 'Beta Access' },
    { key: 'waitlist', label: 'Free / Waitlist' },
  ];

  const filtered = useMemo(() => {
    let list = users;

    if (tab === 'admins') list = list.filter((u) => u.is_admin);
    else if (tab === 'active') list = list.filter((u) => u.tier === 'pro' || u.tier === 'founding');
    else if (tab === 'beta') list = list.filter((u) => u.early_access);
    else if (tab === 'waitlist') list = list.filter((u) => !u.tier || u.tier === 'free');

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.display_name ?? '').toLowerCase().includes(q),
      );
    }

    return list;
  }, [users, tab, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Users</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading...' : `${users.length.toLocaleString()} total users`}
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          USER MANAGEMENT
        </span>
      </div>

      {/* At-Risk Users */}
      {(atRiskLoading || atRiskUsers.length > 0) && (
        <div className="bg-white dark:bg-slate-900 border border-amber-700/40 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-bold text-amber-400">At-Risk Users</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              NO SESSION &gt; 14 DAYS
            </span>
            {!atRiskLoading && (
              <span className="text-[10px] font-mono text-slate-500 ml-auto">{atRiskUsers.length} user{atRiskUsers.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {atRiskLoading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                  </div>
                  <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {atRiskUsers.map((user) => {
                const daysSince = user.last_session_at
                  ? Math.floor((Date.now() - new Date(user.last_session_at).getTime()) / 86400_000)
                  : null;

                const tierColours: Record<string, string> = {
                  founding:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
                  standard:        'bg-sky-500/10 text-sky-400 border-sky-500/30',
                  public_funds:    'bg-purple-500/10 text-purple-400 border-purple-500/30',
                  vocali_freemium: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
                  pro:             'bg-sky-500/10 text-sky-400 border-sky-500/30',
                  free:            'bg-slate-700/50 text-slate-400 border-slate-600/30',
                };
                const tierCls = user.tier ? (tierColours[user.tier] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/30') : null;

                return (
                  <div key={user.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold font-mono flex-shrink-0">
                      {(user.display_name ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white text-xs font-medium truncate">
                        {user.display_name ?? <span className="text-slate-500 italic">No name</span>}
                      </p>
                      <p className="text-[10px] font-mono text-amber-600 mt-0.5">
                        {daysSince === null ? 'Never practiced' : `Last session: ${daysSince} day${daysSince !== 1 ? 's' : ''} ago`}
                      </p>
                    </div>
                    {tierCls && user.tier && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${tierCls}`}>
                        {user.tier.toUpperCase()}
                      </span>
                    )}
                    <a
                      href={`/admin/users/${user.id}`}
                      className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-600 transition-colors"
                    >
                      View profile
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
        />
        <div className="flex gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Tier</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Admin</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Beta</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Onboarded</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Last seen</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-sm">
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Initials name={user.display_name} email={user.email} />
                        <div className="min-w-0">
                          <p className="text-slate-900 dark:text-white text-xs font-medium truncate">{user.email}</p>
                          {user.display_name && (
                            <p className="text-slate-500 text-[10px] font-mono truncate">{user.display_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={user.tier} />
                    </td>
                    <td className="px-4 py-3">
                      {user.is_admin && <AdminBadge />}
                    </td>
                    <td className="px-4 py-3">
                      {user.early_access && <EarlyAccessBadge />}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-mono ${
                          user.onboarding_complete ? 'text-emerald-400' : 'text-slate-600'
                        }`}
                      >
                        {user.onboarding_complete ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {formatDate(user.last_sign_in_at)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionsDropdown
                        user={user}
                        onToggleAdmin={handleToggleAdmin}
                        onToggleEarlyAccess={handleToggleEarlyAccess}
                        onResetPassword={handleResetPassword}
                        loading={actionLoading === user.id}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border text-sm font-medium shadow-xl ${
            toast.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-300'
              : 'bg-red-900/90 border-red-500/30 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
