'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { SessionQualityData, UserProgress } from '@/app/api/admin/session-quality/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatMins(mins: number): string {
  if (mins < 1) return `${Math.round(mins * 60)}s`;
  return `${mins.toFixed(1)}m`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color = 'text-slate-900 dark:text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p className={`text-3xl font-black leading-none ${color}`}>{value}</p>
      {sub && (
        <p className="text-[10px] text-slate-600 font-mono mt-2">{sub}</p>
      )}
    </div>
  );
}

// ── Trend Split Bar ───────────────────────────────────────────────────────────

function TrendSplitBar({
  improving,
  plateauing,
  regressing,
  noData,
}: {
  improving: number;
  plateauing: number;
  regressing: number;
  noData: number;
}) {
  const total = improving + plateauing + regressing;

  if (total === 0) {
    return (
      <p className="text-xs text-slate-600 font-mono py-4 text-center">
        No users with enough sessions yet
      </p>
    );
  }

  const iPct = (improving / total) * 100;
  const pPct = (plateauing / total) * 100;
  const rPct = (regressing / total) * 100;

  return (
    <div>
      {/* Bar */}
      <div className="flex h-8 rounded-xl overflow-hidden gap-0.5">
        {improving > 0 && (
          <div
            className="bg-emerald-500 flex items-center justify-center"
            style={{ width: `${iPct}%` }}
            title={`Improving: ${improving}`}
          >
            {iPct > 10 && (
              <span className="text-[10px] font-mono font-bold text-emerald-950">
                {improving}
              </span>
            )}
          </div>
        )}
        {plateauing > 0 && (
          <div
            className="bg-slate-600 flex items-center justify-center"
            style={{ width: `${pPct}%` }}
            title={`Plateauing: ${plateauing}`}
          >
            {pPct > 10 && (
              <span className="text-[10px] font-mono font-bold text-slate-200">
                {plateauing}
              </span>
            )}
          </div>
        )}
        {regressing > 0 && (
          <div
            className="bg-red-500 flex items-center justify-center"
            style={{ width: `${rPct}%` }}
            title={`Regressing: ${regressing}`}
          >
            {rPct > 10 && (
              <span className="text-[10px] font-mono font-bold text-red-950">
                {regressing}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[11px] font-mono text-slate-400">
            Improving — {improving} ({iPct.toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-slate-600" />
          <span className="text-[11px] font-mono text-slate-400">
            Plateauing — {plateauing} ({pPct.toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500" />
          <span className="text-[11px] font-mono text-slate-400">
            Regressing — {regressing} ({rPct.toFixed(0)}%)
          </span>
        </div>
      </div>

      {noData > 0 && (
        <p className="text-[10px] font-mono text-slate-600 mt-2">
          + {noData} user{noData === 1 ? '' : 's'} with fewer than 3 sessions (trend not yet computed)
        </p>
      )}
    </div>
  );
}

// ── Engagement Funnel ─────────────────────────────────────────────────────────

function FunnelRow({
  label,
  count,
  max,
  total,
  barColor,
}: {
  label: string;
  count: number;
  max: number;
  total: number;
  barColor: string;
}) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
  const barW = max > 0 ? (count / max) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-36 shrink-0">{label}</span>
      <span className="text-xs font-mono text-slate-900 dark:text-white w-8 text-right shrink-0">
        {count}
      </span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${barW}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-slate-500 w-8 text-right shrink-0">
        {pct}%
      </span>
    </div>
  );
}

function EngagementFunnel({ data }: { data: SessionQualityData }) {
  const {
    funnelNever,
    funnelTriedOnce,
    funnelOccasional,
    funnelRegular,
    funnelCommitted,
  } = data;
  const total =
    funnelNever + funnelTriedOnce + funnelOccasional + funnelRegular + funnelCommitted;
  const max = Math.max(
    funnelNever,
    funnelTriedOnce,
    funnelOccasional,
    funnelRegular,
    funnelCommitted,
    1
  );

  return (
    <div className="space-y-3">
      <FunnelRow
        label="Never practiced (0)"
        count={funnelNever}
        max={max}
        total={total}
        barColor="bg-slate-600"
      />
      <FunnelRow
        label="Tried once (1)"
        count={funnelTriedOnce}
        max={max}
        total={total}
        barColor="bg-red-500/70"
      />
      <FunnelRow
        label="Occasional (2–4)"
        count={funnelOccasional}
        max={max}
        total={total}
        barColor="bg-amber-500"
      />
      <FunnelRow
        label="Regular (5–9)"
        count={funnelRegular}
        max={max}
        total={total}
        barColor="bg-sky-500"
      />
      <FunnelRow
        label="Committed (10+)"
        count={funnelCommitted}
        max={max}
        total={total}
        barColor="bg-emerald-500"
      />
    </div>
  );
}

// ── Sparkline (30 days) ───────────────────────────────────────────────────────

function SessionSparkline({ byDay }: { byDay: Record<string, number> }) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const vals = days.map(d => byDay[d] ?? 0);
  const max = Math.max(...vals, 1);
  const today = days[29];

  return (
    <div className="flex items-end gap-0.5 h-16">
      {days.map((d, i) => {
        const h = Math.max(2, Math.round((vals[i] / max) * 64));
        const isToday = d === today;
        return (
          <div
            key={d}
            className="group relative flex-1 flex flex-col items-center justify-end"
          >
            <div
              style={{ height: h }}
              className={`w-full rounded-sm transition-all ${
                isToday
                  ? 'bg-emerald-400'
                  : 'bg-slate-700 group-hover:bg-slate-500'
              }`}
            />
            {vals[i] > 0 && (
              <span className="absolute -top-4 text-[8px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {vals[i]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tier Badge ────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string | null }) {
  const map: Record<string, string> = {
    founding:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
    standard:        'bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-600',
    public_funds:    'bg-sky-500/10 text-sky-400 border-sky-500/30',
    vocali_freemium: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700',
  };
  const label = tier ?? 'standard';
  const cls = map[label] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700';
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${cls} uppercase`}
    >
      {label.replace(/_/g, ' ')}
    </span>
  );
}

// ── Trend indicator ───────────────────────────────────────────────────────────

function TrendArrow({ trend }: { trend: UserProgress['trend'] }) {
  if (trend === 'improving') {
    return <span className="text-emerald-400 font-mono font-bold">&#x2198;</span>;
  }
  if (trend === 'regressing') {
    return <span className="text-red-400 font-mono font-bold">&#x2197;</span>;
  }
  if (trend === 'plateauing') {
    return <span className="text-slate-500 font-mono font-bold">&#x2192;</span>;
  }
  return <span className="text-slate-700 font-mono">&#x2014;</span>;
}

// ── User Progress Table ───────────────────────────────────────────────────────

type TrendSort = 'none' | 'improving' | 'regressing';

function UserTable({ users }: { users: UserProgress[] }) {
  const [query, setQuery] = useState('');
  const [trendSort, setTrendSort] = useState<TrendSort>('none');

  const filtered = users.filter(u => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (trendSort === 'none') return 0;
    const priority = trendSort === 'improving'
      ? ['improving', 'plateauing', 'regressing', 'no_data']
      : ['regressing', 'plateauing', 'improving', 'no_data'];
    return priority.indexOf(a.trend) - priority.indexOf(b.trend);
  });

  function cycleTrendSort() {
    setTrendSort(prev =>
      prev === 'none' ? 'improving' : prev === 'improving' ? 'regressing' : 'none'
    );
  }

  const trendSortLabel =
    trendSort === 'none'
      ? 'Trend'
      : trendSort === 'improving'
      ? 'Trend (best first)'
      : 'Trend (worst first)';

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 font-mono"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left py-2 pr-4 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
                User
              </th>
              <th className="text-left py-2 pr-4 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
                Tier
              </th>
              <th className="text-right py-2 pr-4 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
                Sessions
              </th>
              <th className="text-right py-2 pr-4 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
                Avg Blk/Min
              </th>
              <th
                className="text-left py-2 pr-4 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest cursor-pointer select-none hover:text-slate-400 transition-colors"
                onClick={cycleTrendSort}
                title="Click to sort by trend"
              >
                {trendSortLabel} {trendSort !== 'none' ? '↕' : ''}
              </th>
              <th className="text-right py-2 pr-4 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
                Impr. %
              </th>
              <th className="text-right py-2 pr-4 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
                Practice
              </th>
              <th className="text-right py-2 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest">
                Last Session
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-xs font-mono text-slate-600"
                >
                  No users match your search
                </td>
              </tr>
            )}
            {sorted.map(u => {
              const improvPct = u.improvement_pct;
              const improvStr =
                improvPct === null
                  ? '—'
                  : `${improvPct >= 0 ? '+' : ''}${improvPct.toFixed(1)}%`;
              const improvColor =
                improvPct === null
                  ? 'text-slate-600'
                  : improvPct < 0
                  ? 'text-emerald-400'
                  : 'text-red-400';

              return (
                <tr key={u.user_id} className="hover:bg-slate-800/30 transition-colors">
                  {/* User */}
                  <td className="py-2.5 pr-4">
                    <p className="text-slate-900 dark:text-white font-mono text-[11px] truncate max-w-[180px]">
                      {u.email}
                    </p>
                    {u.display_name && (
                      <p className="text-slate-500 text-[10px] mt-0.5 truncate max-w-[180px]">
                        {u.display_name}
                      </p>
                    )}
                  </td>
                  {/* Tier */}
                  <td className="py-2.5 pr-4">
                    <TierBadge tier={u.tier} />
                  </td>
                  {/* Sessions */}
                  <td className="py-2.5 pr-4 text-right font-mono text-slate-900 dark:text-white">
                    {u.session_count}
                  </td>
                  {/* Avg Blk/Min */}
                  <td className="py-2.5 pr-4 text-right font-mono text-amber-400">
                    {u.session_count > 0
                      ? u.avg_blocks_per_min.toFixed(2)
                      : '—'}
                  </td>
                  {/* Trend */}
                  <td className="py-2.5 pr-4 text-center">
                    <TrendArrow trend={u.trend} />
                  </td>
                  {/* Improvement % */}
                  <td className={`py-2.5 pr-4 text-right font-mono ${improvColor}`}>
                    {improvStr}
                  </td>
                  {/* Total practice */}
                  <td className="py-2.5 pr-4 text-right font-mono text-slate-400">
                    {u.session_count > 0 ? formatMins(u.total_practice_mins) : '—'}
                  </td>
                  {/* Last session */}
                  <td className="py-2.5 text-right font-mono text-slate-500">
                    {u.last_session_at ? timeAgo(u.last_session_at) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function SessionQualityClient({
  initialData,
}: {
  initialData: SessionQualityData;
}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/session-quality', { cache: 'no-store' });
      if (res.ok) {
        setData(await res.json() as SessionQualityData);
        setLastRefresh(Date.now());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const secsSince = Math.floor((Date.now() - lastRefresh) / 1000);

  const improvPctColor =
    data.improvingPct > 50
      ? 'text-emerald-400'
      : data.improvingPct > 25
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Session Quality
          </h1>
          <p className="text-slate-500 text-xs font-mono mt-1">
            Updated {secsSince < 5 ? 'just now' : `${secsSince}s ago`} · auto-refreshes every 60s
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40 self-start sm:self-auto"
        >
          {loading ? '↻ Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* A. KPI row */}
      <div>
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-3">
          Key Metrics
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            label="Active Users (30d)"
            value={data.activeUsersMonth.toString()}
            color={data.activeUsersMonth > 0 ? 'text-emerald-400' : 'text-slate-500'}
          />
          <KpiCard
            label="Avg Blocks/Min"
            value={data.avgBlocksPerMin.toFixed(2)}
            sub="lower = better"
            color="text-amber-400"
          />
          <KpiCard
            label="Improving Users"
            value={`${data.improvingPct.toFixed(0)}%`}
            sub={`${data.improvingCount} of ${data.improvingCount + data.plateauingCount + data.regressingCount} with data`}
            color={improvPctColor}
          />
          <KpiCard
            label="Avg Sessions/User"
            value={data.avgSessionsPerUser.toFixed(1)}
            color="text-slate-900 dark:text-white"
          />
          <KpiCard
            label="Avg Duration"
            value={formatDuration(data.avgDurationSeconds)}
            color="text-slate-900 dark:text-white"
          />
          <KpiCard
            label="Sessions This Month"
            value={data.totalSessionsMonth.toString()}
            color="text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* B. Trend split + C. Funnel side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* B. Trend split bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-4">
            Progress Trend Split
          </p>
          <TrendSplitBar
            improving={data.improvingCount}
            plateauing={data.plateauingCount}
            regressing={data.regressingCount}
            noData={data.noDataCount}
          />
        </div>

        {/* C. Engagement funnel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-4">
            Engagement Funnel
          </p>
          <EngagementFunnel data={data} />
        </div>
      </div>

      {/* D. Session volume sparkline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-slate-900 dark:text-white">Session Volume — last 30 days</p>
          <span className="text-xs font-mono text-slate-500">
            {data.totalSessionsMonth} total
          </span>
        </div>
        <SessionSparkline byDay={data.sessionsByDay} />
        {/* Day labels: first, mid, last */}
        <div className="flex justify-between mt-2">
          {(() => {
            const days = Array.from({ length: 30 }, (_, i) => {
              const d = new Date(Date.now() - (29 - i) * 86400_000);
              return d;
            });
            const indices = [0, 9, 19, 29];
            return indices.map(i => (
              <span key={i} className="text-[9px] font-mono text-slate-700">
                {days[i].toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            ));
          })()}
        </div>
      </div>

      {/* E. User progress table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-4">
          User Progress
        </p>
        {data.users.length === 0 ? (
          <p className="text-xs font-mono text-slate-600 py-8 text-center">
            No users yet
          </p>
        ) : (
          <UserTable users={data.users} />
        )}
      </div>
    </div>
  );
}
