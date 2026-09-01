'use client';

import React, { useEffect, useState } from 'react';
import type { ReferralStats, ReferralTopReferrer } from '@/app/api/admin/analytics/referral/route';

// ── Helpers ────────────────────────────────────────────────────────────────────

function convColour(pct: number): string {
  if (pct === 0)  return 'text-slate-500';
  if (pct < 5)    return 'text-red-400';
  if (pct < 20)   return 'text-amber-400';
  return 'text-emerald-400';
}

// ── Funnel step ────────────────────────────────────────────────────────────────

function Step({
  label, count, pctOfTop, convFromPrev, isFirst, dotColor,
}: {
  label:        string;
  count:        number;
  pctOfTop:     number;
  convFromPrev: number;
  isFirst:      boolean;
  dotColor:     string;
}) {
  const shrink = Math.max(0, (100 - pctOfTop) / 2);
  return (
    <div>
      {!isFirst && (
        <div className="flex items-center justify-center py-1">
          <span className={`text-xs font-mono font-semibold ${convColour(convFromPrev)}`}>
            ↓ {convFromPrev}% from previous
          </span>
        </div>
      )}
      <div
        style={{ marginLeft: `${shrink}%`, marginRight: `${shrink}%` }}
        className="border rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-violet-500/10 border-violet-500/30 transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-sm font-bold text-white truncate">{label}</span>
        </div>
        <div className="flex items-baseline gap-2 shrink-0">
          <span className="text-xl font-black text-white font-mono">{count.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 font-mono">{pctOfTop}% of referrers</span>
        </div>
      </div>
    </div>
  );
}

// ── Top-referrer row ───────────────────────────────────────────────────────────

function TopRow({ r, rank }: { r: ReferralTopReferrer; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-[11px] font-mono text-slate-600 w-4 shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-200 truncate">{r.name}</p>
        <p className="text-[10px] font-mono text-slate-600">{r.code}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0 text-[10px] font-mono">
        <span className="text-slate-400">{r.clicks} clicks</span>
        <span className="text-emerald-400 font-semibold">{r.signups} signups</span>
        {r.subscriptions > 0 && (
          <span className="text-purple-400 font-semibold">{r.subscriptions} subs</span>
        )}
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[100, 72, 44, 28].map((w, i) => (
        <div key={i} style={{ marginLeft: `${(100 - w) / 2}%`, marginRight: `${(100 - w) / 2}%` }}>
          <div className="h-12 bg-slate-800 rounded-xl" />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="h-14 bg-slate-800 rounded-xl" />
        <div className="h-14 bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function ReferralPanel() {
  const [data, setData]       = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/analytics/referral');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as ReferralStats;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const top = data?.totalReferrers ?? 0;

  // Safe pct-of-top for each stage
  function pctOf(n: number) {
    return top > 0 ? Math.round((n / top) * 100) : 0;
  }

  const stages = data ? [
    { label: 'Referrers',     count: data.totalReferrers,    pctOfTop: 100,                         conv: 100,                  dot: 'bg-violet-400' },
    { label: 'Active (clicked)', count: data.activeReferrers, pctOfTop: pctOf(data.activeReferrers), conv: pctOf(data.activeReferrers), dot: 'bg-sky-400' },
    { label: 'Clicks sent',   count: data.totalClicks,       pctOfTop: Math.min(100, pctOf(data.totalClicks)), conv: data.activeReferrers > 0 ? Math.round((data.totalClicks / data.activeReferrers)) : 0, dot: 'bg-blue-400' },
    { label: 'Signups',       count: data.totalSignups,      pctOfTop: pctOf(data.totalSignups),    conv: data.clickToSignupPct,  dot: 'bg-emerald-400' },
    { label: 'Subscriptions', count: data.totalSubscriptions, pctOfTop: pctOf(data.totalSubscriptions), conv: data.signupToSubPct, dot: 'bg-purple-400' },
  ] : [];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Referral Funnel</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/30">
            USER → SUBSCRIBER
          </span>
        </div>
      </div>

      {loading && <Skeleton />}

      {!loading && error && (
        <p className="text-sm text-red-400 font-mono py-8 text-center">Failed to load: {error}</p>
      )}

      {!loading && !error && data && (
        <>
          {top === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              No referrals yet — data appears once users visit the Refer page.
            </p>
          ) : (
            <div className="space-y-0">
              {stages.map((s, i) => (
                <Step
                  key={s.label}
                  label={s.label}
                  count={s.count}
                  pctOfTop={s.pctOfTop}
                  convFromPrev={s.conv}
                  isFirst={i === 0}
                  dotColor={s.dot}
                />
              ))}
            </div>
          )}

          {/* Conversion rate pills */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            {[
              { label: 'Click → Signup',   value: `${data.clickToSignupPct}%`,   sub: `${data.totalSignups} signups from ${data.totalClicks} clicks` },
              { label: 'Signup → Paid',    value: `${data.signupToSubPct}%`,     sub: `${data.totalSubscriptions} subs from ${data.totalSignups} signups` },
            ].map(c => (
              <div key={c.label} className="bg-slate-100/80 dark:bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-1">{c.label}</p>
                <p className={`text-2xl font-black font-mono ${convColour(parseInt(c.value))}`}>{c.value}</p>
                <p className="text-[10px] text-slate-500 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Top referrers */}
          {data.topReferrers.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">
                Top referrers
              </p>
              <div>
                {data.topReferrers.map((r, i) => (
                  <TopRow key={r.code} r={r} rank={i + 1} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
