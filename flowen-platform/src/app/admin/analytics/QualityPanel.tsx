'use client';

import React, { useEffect, useState } from 'react';
import type { QualityData, WeeklyQualityPoint } from '@/app/api/admin/analytics/quality/route';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function fmtNum(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function blocksColor(bpm: number): string {
  if (bpm < 2)  return 'text-emerald-400';
  if (bpm <= 5) return 'text-amber-400';
  return 'text-red-400';
}

function blocksCellClass(bpm: number): string {
  if (bpm < 2)  return 'text-emerald-400';
  if (bpm <= 3) return 'text-teal-400';
  if (bpm <= 5) return 'text-amber-400';
  return 'text-red-400';
}

function durationColor(seconds: number): string {
  if (seconds >= 300) return 'text-emerald-400';  // ≥ 5 min
  if (seconds >= 120) return 'text-amber-400';     // 2–5 min
  return 'text-red-400';                           // < 2 min
}

// ── Trend arrow ───────────────────────────────────────────────────────────────

function TrendArrow({ current, prior }: { current: number; prior: number | null }) {
  if (prior === null || prior === 0) return <span className="text-slate-600">—</span>;
  const delta = current - prior;
  // For blocks/min: lower is better, so down arrow = improving
  if (delta < -0.1) return <span className="text-emerald-400 font-bold">↓</span>;
  if (delta > 0.1)  return <span className="text-red-400 font-bold">↑</span>;
  return <span className="text-slate-400">→</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function QualitySkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="h-4 w-64 bg-slate-800 rounded mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="h-8 flex-1 bg-slate-800 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function QualityStat({
  label,
  value,
  sub,
  valueColor = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-black ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Weekly trend table ────────────────────────────────────────────────────────

function WeeklyTable({ weekly }: { weekly: WeeklyQualityPoint[] }) {
  if (weekly.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-slate-800">
            {['Week', 'Sessions', 'Users', 'Avg Duration', 'Blocks/Min', 'Reps/Min', 'Prolongations/Min', 'Total Dysfl/Min'].map(
              (col) => (
                <th
                  key={col}
                  className="pb-2 pr-4 font-mono text-[10px] text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {weekly.map((row, idx) => {
            const prior = idx > 0 ? weekly[idx - 1] : null;
            return (
              <tr key={row.week} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-2 pr-4 font-mono text-slate-300 whitespace-nowrap">
                  {row.week}
                  <span className="ml-1 text-slate-600 text-[10px]">{row.date.slice(5)}</span>
                </td>
                <td className="py-2 pr-4 font-mono text-slate-400">{row.sessions}</td>
                <td className="py-2 pr-4 font-mono text-slate-400">{row.unique_users}</td>
                <td className="py-2 pr-4 font-mono text-slate-300">{fmtDuration(row.avg_duration_seconds)}</td>
                <td className="py-2 pr-4 font-mono whitespace-nowrap">
                  <span className={blocksCellClass(row.avg_blocks_per_min)}>
                    {fmtNum(row.avg_blocks_per_min)}
                  </span>
                  <span className="ml-1.5">
                    <TrendArrow
                      current={row.avg_blocks_per_min}
                      prior={prior ? prior.avg_blocks_per_min : null}
                    />
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-slate-400">{fmtNum(row.avg_repetitions_per_min)}</td>
                <td className="py-2 pr-4 font-mono text-slate-400">{fmtNum(row.avg_prolongations_per_min)}</td>
                <td className="py-2 pr-4 font-mono text-slate-300">{fmtNum(row.avg_total_disfluencies_per_min)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Trajectory bar ────────────────────────────────────────────────────────────

function TrajectoryBar({ data }: { data: QualityData }) {
  const { improving_users, stable_users, declining_users, insufficient_data_users } = data;
  const withData = improving_users + stable_users + declining_users;
  const total = withData + insufficient_data_users;

  if (total === 0) return null;

  function pct(n: number, d: number): number {
    return d > 0 ? Math.round((n / d) * 100) : 0;
  }

  const segments = [
    {
      count: improving_users,
      label: 'Improving',
      bg: 'bg-emerald-500',
      text: 'text-emerald-400',
      pctOfTotal: pct(improving_users, total),
      pctOfData: pct(improving_users, withData),
    },
    {
      count: stable_users,
      label: 'Stable',
      bg: 'bg-slate-500',
      text: 'text-slate-400',
      pctOfTotal: pct(stable_users, total),
      pctOfData: pct(stable_users, withData),
    },
    {
      count: declining_users,
      label: 'Declining',
      bg: declining_users > 0 ? 'bg-red-500' : 'bg-slate-700',
      text: declining_users > 0 ? 'text-red-400' : 'text-slate-500',
      pctOfTotal: pct(declining_users, total),
      pctOfData: pct(declining_users, withData),
    },
    {
      count: insufficient_data_users,
      label: 'Insuff. data',
      bg: 'bg-slate-700',
      text: 'text-slate-500',
      pctOfTotal: pct(insufficient_data_users, total),
      pctOfData: null,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Segmented bar */}
      <div className="flex h-6 rounded-lg overflow-hidden gap-px">
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.label}
              title={`${s.label}: ${s.count} users (${s.pctOfTotal}%)`}
              className={`${s.bg} transition-all`}
              style={{ width: `${s.pctOfTotal}%`, minWidth: s.count > 0 ? '2px' : '0' }}
            />
          ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-sm ${s.bg}`} />
            <span className={`text-[10px] font-mono ${s.text}`}>
              {s.label}:&nbsp;
              <span className="text-white font-bold">{s.count}</span>
              {s.pctOfData !== null && withData > 0 && (
                <span className="text-slate-500"> ({s.pctOfData}%)</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-600 font-mono leading-relaxed">
        Based on users with ≥6 sessions. Trajectory = change in blocks/min between first 3 and last 3 sessions.
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function QualityPanel() {
  const [data, setData] = useState<QualityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/analytics/quality')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<QualityData>;
      })
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load quality data')
      );
  }, []);

  if (error) {
    return (
      <div className="bg-slate-900 border border-red-800/40 rounded-2xl p-6">
        <p className="text-sm text-red-400 font-mono">Quality data unavailable: {error}</p>
      </div>
    );
  }

  if (!data) return <QualitySkeleton />;

  // Empty state
  if (data.total_sessions_analysed === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-500">
          No session data yet — quality metrics will appear once users complete practice sessions.
        </p>
      </div>
    );
  }

  const withData = data.improving_users + data.stable_users + data.declining_users;

  function pctOfData(n: number): string {
    return withData > 0 ? ` (${Math.round((n / withData) * 100)}%)` : '';
  }

  return (
    <div className="space-y-6">
      {/* Panel header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-sm font-bold text-white">Session Quality &amp; Clinical Outcomes</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            NHS Evidence Pack
          </span>
          <span className="text-[10px] text-slate-600 font-mono ml-auto">
            n = {data.total_sessions_analysed} sessions analysed
          </span>
        </div>

        {/* Outcome stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <QualityStat
            label="Avg Blocks/Min"
            value={fmtNum(data.overall_avg_blocks_per_min)}
            sub="lower is better"
            valueColor={blocksColor(data.overall_avg_blocks_per_min)}
          />
          <QualityStat
            label="Avg Session Duration"
            value={fmtDuration(data.overall_avg_duration_seconds)}
            sub="per session"
            valueColor={durationColor(data.overall_avg_duration_seconds)}
          />
          <QualityStat
            label="Improving Users"
            value={data.improving_users.toLocaleString()}
            sub={`${pctOfData(data.improving_users)} of tracked users`}
            valueColor="text-emerald-400"
          />
          <QualityStat
            label="Declining Users"
            value={data.declining_users.toLocaleString()}
            sub={`${pctOfData(data.declining_users)} of tracked users`}
            valueColor={data.declining_users > 0 ? 'text-red-400' : 'text-slate-400'}
          />
        </div>

        {/* 12-week trend table */}
        {data.weekly.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">
              12-Week Disfluency Trend
            </p>
            <WeeklyTable weekly={data.weekly} />
          </div>
        )}

        {/* Colour key for Blocks/Min */}
        <div className="flex flex-wrap gap-3 mb-8">
          <p className="text-[10px] font-mono text-slate-600 self-center">Blocks/Min key:</p>
          {[
            { label: '<2 excellent',    cls: 'text-emerald-400' },
            { label: '2–3 good',        cls: 'text-teal-400' },
            { label: '3–5 moderate',    cls: 'text-amber-400' },
            { label: '>5 high',         cls: 'text-red-400' },
          ].map(({ label, cls }) => (
            <span key={label} className={`text-[10px] font-mono ${cls}`}>{label}</span>
          ))}
          <span className="text-[10px] font-mono text-slate-500 ml-2">↓ improving · → stable · ↑ worsening</span>
        </div>

        {/* User trajectory breakdown */}
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">
            User Trajectory
          </p>
          <TrajectoryBar data={data} />
        </div>
      </div>
    </div>
  );
}
