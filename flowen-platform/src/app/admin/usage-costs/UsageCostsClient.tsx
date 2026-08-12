'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { UsageCostsData, UserUsageRow } from '@/app/api/admin/usage-costs/route';

// ── Constants (mirrored from route) ──────────────────────────────────────────
const ASR_COST_PER_MIN   = 0.003;
const AI_COST_PER_SESSION = 0.002;
const INFRA_MONTHLY_GBP  = 47.0;
const POLL_INTERVAL_MS   = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGbp(n: number) {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 4 });
}
function fmtMins(secs: number) {
  const m = secs / 60;
  return m < 1 ? `${secs}s` : `${m.toFixed(1)}m`;
}
function fmtRelTime(isoStr: string | null): string {
  if (!isoStr) return 'Never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function fmtDate(isoStr: string | null): string {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TIER_COLORS: Record<string, string> = {
  founding:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
  standard:        'bg-slate-700/50 text-slate-400 border-slate-600/30',
  public_funds:    'bg-sky-500/10 text-sky-400 border-sky-500/30',
  vocali_freemium: 'bg-slate-700/50 text-slate-400 border-slate-600/30',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = 'text-white', icon,
}: {
  label: string; value: string | number; sub?: string; color?: string; icon: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xl">{icon}</span>
      </div>
      <div className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}

function CostBar({ label, amount, pct, color }: { label: string; amount: number; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-mono tabular-nums">{fmtGbp(amount)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="text-[10px] text-slate-600">{pct.toFixed(1)}% of monthly total</div>
    </div>
  );
}

type SortKey = 'totalSeconds' | 'sessionsMonth' | 'estimatedCostMonth' | 'lastSessionAt';

function UserTable({ users }: { users: UserUsageRow[] }) {
  const [sort, setSort]     = useState<SortKey>('totalSeconds');
  const [desc, setDesc]     = useState(true);
  const [search, setSearch] = useState('');

  const filtered = users
    .filter(u => {
      const q = search.toLowerCase();
      return !q || u.email.toLowerCase().includes(q) || (u.displayName ?? '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sort] ?? 0;
      const bv = b[sort] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return desc ? bv.localeCompare(av) : av.localeCompare(bv);
      }
      return desc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

  function toggle(key: SortKey) {
    if (sort === key) setDesc(d => !d);
    else { setSort(key); setDesc(true); }
  }

  function Th({ col, label }: { col: SortKey; label: string }) {
    const active = sort === col;
    return (
      <th
        onClick={() => toggle(col)}
        className="px-4 py-3 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 cursor-pointer select-none hover:text-slate-300 transition-colors whitespace-nowrap"
      >
        {label}{active ? (desc ? ' ↓' : ' ↑') : ''}
      </th>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      {/* Search bar */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/30">
        <input
          type="text"
          placeholder="Search by email or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:max-w-xs bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/40">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">User</th>
              <th className="px-4 py-3 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Tier</th>
              <Th col="sessionsMonth" label="Sessions / mo" />
              <Th col="totalSeconds"  label="Total Audio" />
              <Th col="estimatedCostMonth" label="Est. Cost / mo" />
              <Th col="lastSessionAt"  label="Last Active" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-600 text-xs">No users found</td>
              </tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-200 truncate max-w-[180px]">{u.displayName ?? u.email.split('@')[0]}</div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${TIER_COLORS[u.tier ?? ''] ?? 'bg-slate-700/50 text-slate-400 border-slate-600/30'}`}>
                    {(u.tier ?? 'std').toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className="text-slate-200 font-medium">{u.sessionsMonth}</span>
                  <span className="text-slate-600 text-xs ml-1">/ {u.totalSessions} total</span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className="text-slate-200 font-medium">{fmtMins(u.secondsMonth)}</span>
                  <span className="text-slate-600 text-xs ml-1">this mo</span>
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {u.estimatedCostMonth > 0
                    ? <span className="text-emerald-400 font-mono font-bold text-xs">{fmtGbp(u.estimatedCostMonth)}</span>
                    : <span className="text-slate-600 text-xs">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-400 text-xs">{fmtRelTime(u.lastSessionAt)}</span>
                  {u.lastSessionAt && (
                    <div className="text-[10px] text-slate-600">{fmtDate(u.lastSessionAt)}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/admin/users`}
                    className="text-xs text-slate-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    View →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-800/60 bg-slate-900/30">
          <p className="text-xs text-slate-600">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  );
}

// ── Main client ────────────────────────────────────────────────────────────────

export default function UsageCostsClient({ initialData }: { initialData: UsageCostsData }) {
  const [data, setData]       = useState<UsageCostsData>(initialData);
  const [lastFetch, setLast]  = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/usage-costs', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: UsageCostsData = await res.json();
      setData(json);
      setLast(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh]);

  const d = data;
  const totalCost = d.totalCostMonth;

  return (
    <div className="space-y-8">

      {/* Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Usage &amp; Costs</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time system-wide and per-user usage with estimated compute costs.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-xs font-mono text-emerald-400">
              {loading ? 'Refreshing…' : `Updated ${fmtRelTime(lastFetch.toISOString())}`}
            </span>
          </div>

          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Failed to refresh: {error}
        </div>
      )}

      {/* System totals ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-4">System Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon="⚡" label="Sessions today"  value={d.sessionsToday}  color="text-white" />
          <StatCard icon="📅" label="Sessions this month" value={d.sessionsMonth} color="text-white" sub={`${d.sessionsWeek} this week`} />
          <StatCard icon="🎙️" label="Audio today"     value={fmtMins(d.secondsToday)} color="text-sky-400" sub={`${fmtMins(d.secondsMonth)} this month`} />
          <StatCard icon="👤" label="Daily active users" value={d.dau}          color="text-emerald-400" sub={`${d.wau} WAU · ${d.mau} MAU`} />
          <StatCard icon="👥" label="Total users"     value={d.totalUsers}     color="text-white" sub={`${d.totalSessions} sessions all-time`} />
          <StatCard icon="💷" label="Est. cost / mo"  value={fmtGbp(totalCost)} color="text-amber-400" sub={`${fmtGbp(d.avgCostPerUser)}/user`} />
        </div>
      </section>

      {/* Cost breakdown ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-4">Cost Breakdown — This Month</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Bar chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-5">
            <CostBar
              label="ASR Pipeline (audio minutes × £0.003/min)"
              amount={d.asrCostMonth}
              pct={totalCost > 0 ? (d.asrCostMonth / totalCost) * 100 : 0}
              color="bg-sky-500"
            />
            <CostBar
              label="AI Processing (sessions × £0.002/session)"
              amount={d.aiCostMonth}
              pct={totalCost > 0 ? (d.aiCostMonth / totalCost) * 100 : 0}
              color="bg-emerald-500"
            />
            <CostBar
              label={`Infrastructure (Vercel Pro + Supabase flat £${INFRA_MONTHLY_GBP}/mo)`}
              amount={d.infraCostMonth}
              pct={totalCost > 0 ? (d.infraCostMonth / totalCost) * 100 : 0}
              color="bg-amber-500"
            />
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Total estimated this month</span>
              <span className="text-lg font-extrabold text-white tabular-nums">{fmtGbp(totalCost)}</span>
            </div>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Estimates only. ASR based on Deepgram Nova-2 rates (~£0.003/min). AI processing estimated from
              Claude Haiku inference per session. Infrastructure costs are actual flat-rate subscriptions.
            </p>
          </div>

          {/* Metrics grid */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-5">Usage Metrics</h3>
            <div className="space-y-4">
              {[
                { label: 'Total audio processed (month)',  value: fmtMins(d.secondsMonth),    detail: `${(d.secondsMonth / 60).toFixed(1)} minutes` },
                { label: 'Total audio processed (all-time)', value: fmtMins(d.totalSeconds), detail: `${(d.totalSeconds / 60).toFixed(1)} minutes` },
                { label: 'Avg session length',             value: d.totalSessions > 0 ? fmtMins(Math.round(d.totalSeconds / d.totalSessions)) : '—', detail: 'across all sessions' },
                { label: 'ASR cost per active user / mo',  value: d.mau > 0 ? fmtGbp(d.asrCostMonth / d.mau) : '—', detail: 'audio processing only' },
                { label: 'Cost per session (variable)',    value: d.sessionsMonth > 0 ? fmtGbp((d.asrCostMonth + d.aiCostMonth) / d.sessionsMonth) : '—', detail: 'excludes infra fixed costs' },
                { label: 'Infra cost per user',           value: d.totalUsers > 0 ? fmtGbp(INFRA_MONTHLY_GBP / d.totalUsers) : '—', detail: 'amortised across all users' },
              ].map(row => (
                <div key={row.label} className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400">{row.label}</div>
                    <div className="text-[10px] text-slate-600">{row.detail}</div>
                  </div>
                  <span className="text-sm font-mono font-bold text-slate-200 tabular-nums shrink-0">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Per-user breakdown ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Per-User Breakdown</h2>
          <span className="text-xs text-slate-600">{d.totalUsers} users total</span>
        </div>
        <UserTable users={d.users} />
      </section>

      {/* Auto-refresh notice ─────────────────────────────────────────────────── */}
      <p className="text-[10px] text-slate-700 text-center pb-4">
        Auto-refreshes every 30 seconds · Data served server-side via service role · Admin only
      </p>
    </div>
  );
}
