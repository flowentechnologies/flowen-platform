'use client';

import React, { useEffect, useState } from 'react';
import type { CohortData, CohortRow, ArrProjection } from '@/app/api/admin/analytics/cohort/route';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCurrency(pence: number) {
  return (pence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtPct(n: number): string {
  return `${n}%`;
}

// ── Cell colour ───────────────────────────────────────────────────────────────

function retentionCellClass(value: number): string {
  if (value < 0)  return 'bg-white dark:bg-slate-900 text-slate-700';  // future / no data
  if (value === 0) return 'bg-white dark:bg-slate-900 text-slate-600';
  if (value >= 80) return 'bg-emerald-700/70 text-emerald-100';
  if (value >= 60) return 'bg-teal-700/70 text-teal-100';
  if (value >= 40) return 'bg-amber-700/60 text-amber-100';
  if (value >= 20) return 'bg-orange-700/60 text-orange-100';
  return 'bg-red-900/50 text-red-300';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CohortSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="h-8 flex-1 bg-slate-100 dark:bg-slate-800 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* ARR card skeleton */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded mb-4" />
        <div className="h-10 w-40 bg-slate-100 dark:bg-slate-800 rounded mb-6" />
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Cohort table ──────────────────────────────────────────────────────────────

function CohortTable({ cohorts }: { cohorts: CohortRow[] }) {
  if (cohorts.length < 2) {
    return (
      <p className="text-sm text-slate-500 py-4">
        Not enough data yet — cohort analysis requires at least 2 weeks of signups.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="pr-4 pb-2 text-[10px] font-mono text-slate-500 uppercase tracking-wide whitespace-nowrap">
              Cohort
            </th>
            <th className="pr-4 pb-2 text-[10px] font-mono text-slate-500 uppercase tracking-wide whitespace-nowrap">
              Size
            </th>
            {Array.from({ length: 8 }, (_, i) => (
              <th
                key={i}
                className="px-2 pb-2 text-[10px] font-mono text-slate-500 uppercase tracking-wide text-center whitespace-nowrap"
              >
                W+{i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {cohorts.map((row) => (
            <tr key={row.week}>
              <td className="pr-4 py-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {row.label}
              </td>
              <td className="pr-4 py-1.5 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                n={row.size}
              </td>
              {row.retention.map((val, wIdx) => (
                <td key={wIdx} className="px-1 py-1.5 text-center">
                  <span
                    className={`inline-block w-full px-1 py-1 rounded text-[10px] font-mono font-medium text-center ${retentionCellClass(val)}`}
                  >
                    {val < 0 ? '—' : fmtPct(val)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ARR projection card ───────────────────────────────────────────────────────

function ArrCard({ projection }: { projection: ArrProjection }) {
  const { currentArr, threeMonth, sixMonth, twelveMonth, weeklyGrowthRate } = projection;

  if (currentArr === 0) {
    return (
      <p className="text-sm text-slate-500 py-2">
        Pre-revenue — projection available once first subscription is activated.
      </p>
    );
  }

  const growthPct = (weeklyGrowthRate * 100).toFixed(2);

  const projections = [
    { label: '3 months', value: threeMonth,  size: 'text-xl' },
    { label: '6 months', value: sixMonth,    size: 'text-2xl' },
    { label: '12 months', value: twelveMonth, size: 'text-3xl' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4">
        <div>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-1">Current ARR</p>
          <p className="text-4xl font-black text-emerald-400">{fmtCurrency(currentArr)}</p>
        </div>
        <span className="mb-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          +{growthPct}% / week
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {projections.map(({ label, value, size }) => (
          <div
            key={label}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
          >
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mb-2">{label}</p>
            <p className={`font-black text-slate-900 dark:text-white ${size}`}>{fmtCurrency(value)}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-600 font-mono leading-relaxed">
        Projection assumes current growth rate continues. Update with actual subscriber data as it accrues.
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CohortPanel() {
  const [data, setData] = useState<CohortData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/analytics/cohort')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CohortData>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load cohort data'));
  }, []);

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-red-800/40 rounded-2xl p-6">
        <p className="text-sm text-red-400 font-mono">Cohort data unavailable: {error}</p>
      </div>
    );
  }

  if (!data) return <CohortSkeleton />;

  return (
    <div className="space-y-6">
      {/* Cohort Retention Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cohort Retention</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
            8-WEEK WINDOW
          </span>
          <span className="text-[10px] text-slate-600 font-mono ml-auto">
            {new Date(data.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-5">
          {[
            { label: '≥80%', cls: 'bg-emerald-700/70 text-emerald-100' },
            { label: '60–79%', cls: 'bg-teal-700/70 text-teal-100' },
            { label: '40–59%', cls: 'bg-amber-700/60 text-amber-100' },
            { label: '20–39%', cls: 'bg-orange-700/60 text-orange-100' },
            { label: '<20%', cls: 'bg-red-900/50 text-red-300' },
          ].map(({ label, cls }) => (
            <span key={label} className={`px-2 py-0.5 rounded text-[10px] font-mono ${cls}`}>
              {label}
            </span>
          ))}
        </div>

        <CohortTable cohorts={data.cohorts} />
      </div>

      {/* ARR Trajectory */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">ARR Trajectory</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            PROJECTION
          </span>
        </div>
        <ArrCard projection={data.arrProjection} />
      </div>
    </div>
  );
}
