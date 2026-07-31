'use client';

import React, { useState, useTransition, useCallback } from 'react';
import type { AnalyticsData } from '@/app/api/admin/analytics/route';
import { CohortPanel } from './CohortPanel';
import { QualityPanel } from './QualityPanel';

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = 7 | 30 | 90;

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtCurrency(pence: number) {
  return (pence / 100).toLocaleString('en-GB', {
    style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function fmtDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function growthBadge(pct: number) {
  if (pct > 0)  return <span className="text-[9px] font-mono text-emerald-400">+{pct}%</span>;
  if (pct < 0)  return <span className="text-[9px] font-mono text-red-400">{pct}%</span>;
  return <span className="text-[9px] font-mono text-slate-500">—</span>;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function rangeDays(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function DayBars({ days, counts, color = 'bg-emerald-500' }: { days: string[]; counts: Record<string, number>; color?: string }) {
  const max = Math.max(...days.map(d => counts[d] ?? 0), 1);
  return (
    <div className="flex items-end gap-px" style={{ height: 72 }}>
      {days.map(day => {
        const v = counts[day] ?? 0;
        const h = v > 0 ? Math.max((v / max) * 100, 4) : 0;
        return (
          <div
            key={day}
            title={`${shortDate(day)}: ${v}`}
            style={{ height: `${h}%` }}
            className={`flex-1 rounded-t transition-all ${v > 0 ? `${color}/50 hover:${color}/80` : 'bg-slate-800/30'}`}
          />
        );
      })}
    </div>
  );
}

function AxisLabels({ days }: { days: string[] }) {
  const n = days.length;
  const indices = n <= 7 ? [0, n - 1] : n <= 30 ? [0, 6, 13, 20, n - 1] : [0, 14, 29, 44, 59, n - 1];
  return (
    <div className="relative mt-1" style={{ height: 14 }}>
      {indices.filter(i => i < n).map(i => (
        <span key={i} className="absolute text-[9px] text-slate-600 font-mono -translate-x-1/2" style={{ left: `${(i / (n - 1)) * 100}%` }}>
          {shortDate(days[i])}
        </span>
      ))}
    </div>
  );
}

function HBar({ value, max, color = 'bg-emerald-500' }: { value: number; max: number; color?: string }) {
  const p = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${p}%` }} />
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, sub, valueColor = 'text-white', growth }: {
  label: string; value: string; sub?: string; valueColor?: string; growth?: number;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">{label}</p>
        {growth !== undefined && growthBadge(growth)}
      </div>
      <p className={`text-3xl font-black ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Funnel step ───────────────────────────────────────────────────────────────

function FunnelStep({ label, count, total, prevCount, color = 'bg-emerald-500' }: {
  label: string; count: number; total: number; prevCount?: number; color?: string;
}) {
  const barPct = pct(count, total);
  const conv   = prevCount != null ? pct(count, prevCount) : null;
  return (
    <div className="flex items-center gap-4">
      <div className="w-40 shrink-0 text-right">
        <p className="text-sm font-bold text-white">{count.toLocaleString()}</p>
        <p className="text-[10px] text-slate-400">{label}</p>
      </div>
      <div className="flex-1 h-6 bg-slate-800 rounded-lg overflow-hidden">
        <div className={`h-full ${color}/40 rounded-lg`} style={{ width: `${Math.max(barPct, 1)}%` }} />
      </div>
      <div className="w-16 shrink-0">
        {conv !== null
          ? <span className="text-[10px] font-mono text-slate-500">{conv}% conv.</span>
          : <span className="text-[10px] font-mono text-emerald-400">baseline</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AnalyticsClient({ initialData }: { initialData: AnalyticsData }) {
  const [data, setData]     = useState(initialData);
  const [range, setRange]   = useState<Range>(30);
  const [isPending, start]  = useTransition();
  const [lastRefresh, setLastRefresh] = useState(new Date(initialData.generatedAt));

  const fetch_ = useCallback((days: Range) => {
    start(async () => {
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      if (res.ok) {
        const d = await res.json() as AnalyticsData;
        setData(d);
        setLastRefresh(new Date(d.generatedAt));
      }
    });
  }, []);

  const handleRange = (r: Range) => { setRange(r); fetch_(r); };
  const handleRefresh = () => fetch_(range);

  const days = rangeDays(range);

  const tierOrder  = ['founding', 'standard', 'public_funds', 'vocali_freemium'];
  const tierColors: Record<string, string> = {
    founding:        'bg-amber-400',
    standard:        'bg-sky-400',
    public_funds:    'bg-purple-400',
    vocali_freemium: 'bg-slate-400',
  };
  const tierLabels: Record<string, string> = {
    founding:        'Founding Member',
    standard:        'Standard',
    public_funds:    'Public Funds / NHS',
    vocali_freemium: 'Freemium',
  };
  const maxTierCount = Math.max(...tierOrder.map(t => data.tierCounts[t] ?? 0), 1);

  const totalDisfluencies = data.avgBlocksDetected + data.avgRepsDetected + data.avgProlongDetected;

  const rangeLabel = `vs prev ${range}d`;

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Funnels · Revenue · Clinical outcomes · Engagement</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Range selector */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            {([7, 30, 90] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => handleRange(r)}
                disabled={isPending}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${range === r ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                {r}d
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <svg className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd"/>
            </svg>
            Refresh
          </button>
          <span className="text-[10px] text-slate-600 font-mono hidden lg:block">
            {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Revenue</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="MRR"            value={fmtCurrency(data.mrrPence)}    sub="Monthly recurring"    valueColor="text-emerald-400" />
          <Stat label="ARR"            value={fmtCurrency(data.arrPence)}    sub="Annual run rate"      valueColor="text-emerald-300" />
          <Stat label="Active Subs"    value={data.activeSubs.toLocaleString()} sub="paying subscribers" valueColor="text-white" />
          <Stat label="Trialing"       value={data.trialingSubs.toLocaleString()} sub="in trial"          valueColor="text-sky-400" />
        </div>
      </div>

      {/* User KPIs */}
      <div>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Users</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="Total Users"  value={data.totalUsers.toLocaleString()} />
          <Stat label="DAU"          value={data.dau.toLocaleString()}   sub="active today"      valueColor="text-emerald-400" />
          <Stat label="WAU"          value={data.wau.toLocaleString()}   sub="active 7 days"     valueColor="text-emerald-400" />
          <Stat label="MAU"          value={data.mau.toLocaleString()}   sub={`active ${range}d`} valueColor="text-emerald-400" />
          <Stat label="DAU/MAU"      value={`${data.dauMauRatio}%`}      sub="engagement ratio"  valueColor={parseFloat(data.dauMauRatio) >= 10 ? 'text-emerald-400' : 'text-amber-400'} />
          <Stat label="Total Sessions" value={data.totalSessions.toLocaleString()} sub="all time" valueColor="text-sky-400" />
        </div>
      </div>

      {/* Acquisition funnel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-sm font-bold text-white">Acquisition Funnel</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            CONVERSION
          </span>
        </div>
        <div className="space-y-3">
          <FunnelStep label="Waitlist"          count={data.waitlistTotal}   total={data.waitlistTotal}   color="bg-sky-500" />
          <FunnelStep label="Registered"        count={data.totalUsers}      total={data.waitlistTotal}   prevCount={data.waitlistTotal}  color="bg-sky-500" />
          <FunnelStep label="Onboarded"         count={data.onboarded}       total={data.waitlistTotal}   prevCount={data.totalUsers}     color="bg-emerald-500" />
          <FunnelStep label="Subscribed"        count={data.activeSubs}      total={data.waitlistTotal}   prevCount={data.onboarded}      color="bg-emerald-500" />
          <FunnelStep label={`Practised (${range}d)`} count={data.practicedUsers} total={data.waitlistTotal} prevCount={data.activeSubs} color="bg-amber-400" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { label: 'Waitlist → Registered',   value: `${pct(data.totalUsers, data.waitlistTotal)}%` },
            { label: 'Registered → Onboarded',  value: `${pct(data.onboarded, data.totalUsers)}%` },
            { label: 'Onboarded → Subscribed',  value: `${pct(data.activeSubs, data.onboarded)}%` },
            { label: 'Subscribed → Practised',  value: `${pct(data.practicedUsers, data.activeSubs)}%` },
          ].map(c => (
            <div key={c.label} className="bg-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <span className="text-[10px] text-slate-400">{c.label}</span>
              <span className="text-sm font-bold text-white font-mono">{c.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">New Registrations ({range}d)</h2>
            <div className="flex items-center gap-2">
              {growthBadge(data.signupGrowthPct)}
              <span className="text-[10px] text-slate-500">{rangeLabel}</span>
            </div>
          </div>
          <DayBars days={days} counts={data.signupsByDay} color="bg-emerald-500" />
          <AxisLabels days={days} />
          <div className="flex justify-between mt-4 pt-4 border-t border-slate-800">
            <span className="text-xs text-slate-500">This period</span>
            <span className="text-xs font-mono font-bold text-white">{data.newSignups} signups</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Practice Sessions ({range}d)</h2>
            <span className="text-[10px] text-slate-500 font-mono">{data.sessionsInRange} sessions</span>
          </div>
          <DayBars days={days} counts={data.sessionsByDay} color="bg-sky-500" />
          <AxisLabels days={days} />
          <div className="flex justify-between mt-4 pt-4 border-t border-slate-800">
            <span className="text-xs text-slate-500">Avg sessions / active user</span>
            <span className="text-xs font-mono font-bold text-white">{data.avgSessionsPerUser}</span>
          </div>
        </div>
      </div>

      {/* Tier distribution + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-5">User Tier Distribution</h2>
          <div className="space-y-3">
            {tierOrder.map(tier => {
              const count = data.tierCounts[tier] ?? 0;
              return (
                <div key={tier} className="flex items-center gap-3">
                  <div className="w-40 shrink-0">
                    <p className="text-xs text-slate-300">{tierLabels[tier]}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{count} users · {pct(count, data.totalUsers)}%</p>
                  </div>
                  <HBar value={count} max={maxTierCount} color={tierColors[tier]} />
                  <span className="w-8 text-right text-xs font-mono text-slate-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-5">Engagement ({range}d)</h2>
          <div className="space-y-0">
            {[
              { label: 'Avg session duration',     value: fmtDuration(data.avgDurationSeconds),  sub: 'per completed session' },
              { label: 'Avg sessions / user',       value: data.avgSessionsPerUser,               sub: 'among active users' },
              { label: 'Onboarding completion',     value: `${pct(data.onboarded, data.totalUsers)}%`, sub: `${data.onboarded} of ${data.totalUsers} users` },
              { label: 'Subscription conversion',   value: `${pct(data.activeSubs, data.onboarded)}%`, sub: `${data.activeSubs} paying subscribers` },
              { label: 'Waitlist size',             value: data.waitlistTotal.toLocaleString(),   sub: 'pending platform access' },
              { label: 'Revenue per active sub',    value: data.activeSubs > 0 ? fmtCurrency(Math.round(data.mrrPence / data.activeSubs)) : '—', sub: 'avg MRR per subscriber' },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between gap-4 py-3 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-xs text-slate-300">{m.label}</p>
                  <p className="text-[10px] text-slate-500">{m.sub}</p>
                </div>
                <span className="text-sm font-bold font-mono text-white shrink-0">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clinical outcomes */}
      {data.sessionsInRange > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-sm font-bold text-white">Clinical Outcomes ({range}d average)</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
              CLINICAL DATA
            </span>
            <span className="text-[10px] text-slate-500 font-mono">n = {data.sessionsInRange} sessions</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Blocks (avg/session)',        value: data.avgBlocksDetected.toFixed(1),   color: 'text-red-400',   barColor: 'bg-red-500',   portion: data.avgBlocksDetected },
              { label: 'Repetitions (avg/session)',   value: data.avgRepsDetected.toFixed(1),     color: 'text-amber-400', barColor: 'bg-amber-500', portion: data.avgRepsDetected },
              { label: 'Prolongations (avg/session)', value: data.avgProlongDetected.toFixed(1),  color: 'text-sky-400',   barColor: 'bg-sky-500',   portion: data.avgProlongDetected },
            ].map(d => (
              <div key={d.label} className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] text-slate-400 mb-2">{d.label}</p>
                <p className={`text-2xl font-black ${d.color}`}>{d.value}</p>
                <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${d.barColor}/50 rounded-full`}
                    style={{ width: totalDisfluencies > 0 ? `${(d.portion / totalDisfluencies) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
          {totalDisfluencies > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase tracking-wide">Disfluency type proportion</p>
              <div className="flex h-4 rounded-full overflow-hidden gap-px">
                <div className="bg-red-500/60"   style={{ width: `${pct(data.avgBlocksDetected,  totalDisfluencies)}%` }} />
                <div className="bg-amber-500/60" style={{ width: `${pct(data.avgRepsDetected,    totalDisfluencies)}%` }} />
                <div className="bg-sky-500/60"   style={{ width: `${pct(data.avgProlongDetected, totalDisfluencies)}%` }} />
              </div>
              <div className="flex gap-4 mt-2">
                {[
                  { label: 'Blocks',        p: pct(data.avgBlocksDetected,  totalDisfluencies), color: 'text-red-400' },
                  { label: 'Repetitions',   p: pct(data.avgRepsDetected,    totalDisfluencies), color: 'text-amber-400' },
                  { label: 'Prolongations', p: pct(data.avgProlongDetected, totalDisfluencies), color: 'text-sky-400' },
                ].map(l => (
                  <span key={l.label} className={`text-[10px] font-mono ${l.color}`}>{l.label} {l.p}%</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Growth summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-5">Growth Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: `Signups (${range}d)`,         value: data.newSignups.toLocaleString(),                        sub: `${data.signupGrowthPct > 0 ? '+' : ''}${data.signupGrowthPct}% ${rangeLabel}`,   growth: data.signupGrowthPct },
            { label: `Sessions (${range}d)`,         value: data.sessionsInRange.toLocaleString(),                   sub: 'practice sessions' },
            { label: 'Waitlist total',               value: data.waitlistTotal.toLocaleString(),                     sub: 'pending access' },
            { label: 'Platform reach',               value: (data.totalUsers + data.waitlistTotal).toLocaleString(), sub: 'registered + waitlist' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-slate-400">{s.label}</p>
                {s.growth !== undefined && growthBadge(s.growth)}
              </div>
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cohort retention + ARR projection */}
      <CohortPanel />

      {/* Session Quality Intelligence */}
      <hr className="border-slate-800" />
      <QualityPanel />

      {/* Footer */}
      <p className="text-[10px] text-slate-700 font-mono text-center pb-4">
        Data as of {lastRefresh.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} London
      </p>
    </div>
  );
}
