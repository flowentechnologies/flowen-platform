'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import type { AdminUserRecord } from '@/app/api/admin/users/route';

type FilterTab = 'all' | 'active' | 'admins' | 'waitlist';

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
          <div className="w-8 h-8 rounded-full bg-slate-800" />
          <div className="space-y-1.5">
            <div className="h-3 w-36 bg-slate-800 rounded" />
            <div className="h-2 w-24 bg-slate-800 rounded" />
          </div>
        </div>
      </td>
      <td className="p-4"><div className="h-3 w-16 bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-10 bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-12 bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-20 bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-20 bg-slate-800 rounded" /></td>
      <td className="p-4"><div className="h-3 w-10 bg-slate-800 rounded" /></td>
    </tr>
  );
}

interface DropdownProps {
  user: AdminUserRecord;
  onToggleAdmin: (userId: string) => void;
  onResetPassword: (userId: string, email: string) => void;
  loading: boolean;
}

function ActionsDropdown({ user, onToggleAdmin, onResetPassword, loading }: DropdownProps) {
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
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
      >
        Actions
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
          <button
            type="button"
            onClick={() => { onToggleAdmin(user.id); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {user.is_admin ? 'Remove admin' : 'Make admin'}
          </button>
          <button
            type="button"
            onClick={() => { onResetPassword(user.id, user.email); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            Send password reset
          </button>
          <a
            href={`/admin/users/${user.id}`}
            className="block px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
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

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users) setUsers(data.users);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
    { key: 'waitlist', label: 'Free / Waitlist' },
  ];

  const filtered = useMemo(() => {
    let list = users;

    if (tab === 'admins') list = list.filter((u) => u.is_admin);
    else if (tab === 'active') list = list.filter((u) => u.tier === 'pro' || u.tier === 'founding');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Users</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading...' : `${users.length.toLocaleString()} total users`}
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
          USER MANAGEMENT
        </span>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
        />
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Tier</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Admin</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Onboarded</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide">Last seen</th>
                <th className="px-4 py-3 text-xs font-mono text-slate-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 text-sm">
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
                          <p className="text-white text-xs font-medium truncate">{user.email}</p>
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
