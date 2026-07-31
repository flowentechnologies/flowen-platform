'use client';

import React, { useEffect, useState } from 'react';
import type { FunnelData, FunnelStage } from '@/app/api/admin/analytics/funnel/route';

// ── Stage styling ─────────────────────────────────────────────────────────────

const STAGE_STYLES: Record<string, { bar: string; border: string; dot: string }> = {
  'Waitlist':       { bar: 'bg-sky-500/20',     border: 'border-sky-500/40',     dot: 'bg-sky-400'     },
  'Signed Up':      { bar: 'bg-emerald-500/20', border: 'border-emerald-500/40', dot: 'bg-emerald-400' },
  'Onboarded':      { bar: 'bg-teal-500/20',    border: 'border-teal-500/40',    dot: 'bg-teal-400'    },
  'First Session':  { bar: 'bg-amber-500/20',   border: 'border-amber-500/40',   dot: 'bg-amber-400'   },
  'Paying':         { bar: 'bg-purple-500/20',  border: 'border-purple-500/40',  dot: 'bg-purple-400'  },
};

function conversionColour(pct: number): string {
  if (pct < 20) return 'text-red-400';
  if (pct < 50) return 'text-amber-400';
  return 'text-emerald-400';
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-slate-800/60 ${className ?? ''}`} />
  );
}

function FunnelSkeleton() {
  return (
    <div className="space-y-3">
      {[100, 82, 68, 54, 38].map((w, i) => (
        <div key={i} style={{ marginLeft: `${(100 - w) / 2}%`, marginRight: `${(100 - w) / 2}%` }}>
          <Shimmer className="h-14" />
        </div>
      ))}
      <Shimmer className="h-12 mt-4" />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Shimmer className="h-16" />
        <Shimmer className="h-16" />
      </div>
    </div>
  );
}

// ── Stage bar ─────────────────────────────────────────────────────────────────

function StageBar({ stage, isFirst }: { stage: FunnelStage; isFirst: boolean }) {
  const styles  = STAGE_STYLES[stage.label] ?? STAGE_STYLES['Waitlist'];
  // Funnel trapezoid: wider at top, narrower at bottom via left/right margin
  const shrink  = Math.max(0, (100 - stage.pct_of_top) / 2);
  const colour  = conversionColour(stage.pct_of_prev);

  return (
    <div>
      {/* Conversion arrow between stages */}
      {!isFirst && (
        <div className="flex items-center justify-center py-1">
          <span className={`text-xs font-mono font-semibold ${colour}`}>
            ↓ {stage.pct_of_prev}% from previous
          </span>
        </div>
      )}

      {/* Bar — shrinks proportionally for the funnel illusion */}
      <div
        style={{ marginLeft: `${shrink}%`, marginRight: `${shrink}%` }}
        className={`border rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${styles.bar} ${styles.border} transition-all`}
      >
        {/* Left: stage label */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
          <span className="text-sm font-bold text-white truncate">{stage.label}</span>
        </div>

        {/* Right: count + pct of top */}
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-xl font-black text-white font-mono">
            {stage.count.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {stage.pct_of_top}% of total
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Mini stat card ────────────────────────────────────────────────────────────

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-black text-white font-mono">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FunnelPanel() {
  const [data, setData]       = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [fetchedAt]           = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/analytics/funnel');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as FunnelData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────
  const waitlistCount = data?.stages[0]?.count ?? 0;
  const payingCount   = data?.stages[4]?.count ?? 0;
  const funnelEff     = waitlistCount > 0
    ? Math.round((payingCount / waitlistCount) * 100)
    : 0;

  const dropOffStage  = data?.top_drop_off_stage ?? '';
  const dropOffPct    = data
    ? (data.stages.find(s => s.label === dropOffStage)?.pct_of_prev ?? 0)
    : 0;

  const hasSources    = (data?.waitlist_sources.length ?? 0) > 0;
  const hasAnyData    = waitlistCount > 0 || (data?.stages[1]?.count ?? 0) > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white">Acquisition Funnel</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            WAITLIST → PAYING
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:block">
          Last updated: {fetchedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Content */}
      {loading && <FunnelSkeleton />}

      {!loading && error && (
        <p className="text-sm text-red-400 font-mono py-8 text-center">
          Failed to load funnel data: {error}
        </p>
      )}

      {!loading && !error && !hasAnyData && (
        <p className="text-sm text-slate-500 py-8 text-center">
          Funnel data will appear once you have waitlist signups and user accounts.
        </p>
      )}

      {!loading && !error && hasAnyData && data && (
        <div className="space-y-0">
          {/* Funnel bars */}
          <div className="space-y-0">
            {data.stages.map((stage, i) => (
              <StageBar key={stage.label} stage={stage} isFirst={i === 0} />
            ))}
          </div>

          {/* Drop-off insight banner */}
          <div className="mt-5 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <span className="text-amber-400 text-base leading-none mt-0.5">&#9888;</span>
            <p className="text-xs text-amber-200">
              <span className="font-bold">Biggest drop-off:</span>{' '}
              <span className="font-mono">{dropOffStage}</span>
              {' '}— only{' '}
              <span className="font-black">{dropOffPct}%</span>
              {' '}conversion from previous stage
            </p>
          </div>

          {/* Mini stat cards */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <MiniStat
              label="New this week"
              value={data.week_over_week_signups.toLocaleString()}
              sub="waitlist signups (last 7 days)"
            />
            <MiniStat
              label="Funnel efficiency"
              value={`${funnelEff}%`}
              sub="waitlist → paying (overall)"
            />
          </div>

          {/* Source breakdown */}
          {hasSources && (
            <div className="mt-5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">
                Waitlist sources
              </p>
              <div className="flex flex-wrap gap-2">
                {data.waitlist_sources.map(({ source, count }) => (
                  <span
                    key={source}
                    className="px-3 py-1 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-300 font-mono"
                  >
                    {source}: <span className="font-bold text-white">{count.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
