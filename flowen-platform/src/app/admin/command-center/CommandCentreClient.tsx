'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { CCData } from '@/app/api/admin/command-center/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function gbp(pence: number) {
  return (pence / 100).toLocaleString('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  });
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = 'text-slate-900 dark:text-white', href, alert,
}: {
  label: string; value: string; sub?: string; color?: string; href?: string; alert?: boolean;
}) {
  const inner = (
    <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 h-full ${alert ? 'border-red-500/40 bg-red-500/5' : 'border-slate-200 dark:border-slate-800'}`}>
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-black ${color} leading-none`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 font-mono mt-2">{sub}</p>}
    </div>
  );
  if (href) return <Link href={href} className="block h-full hover:opacity-80 transition-opacity">{inner}</Link>;
  return inner;
}

function HealthPill({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  const color = !ok ? 'bg-red-400' : warn ? 'bg-amber-400' : 'bg-emerald-400';
  const text  = !ok ? 'text-red-400' : warn ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${color} ${ok && !warn ? 'animate-pulse' : ''}`} />
      <span className={`text-[10px] font-mono font-bold ${text}`}>{label}</span>
    </div>
  );
}

function OkrBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  const p = Math.min(100, pct(current, goal));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-[10px] font-mono text-slate-500">{current.toLocaleString()} / {goal.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function Sparkline({ byDay }: { byDay: Record<string, number> }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const vals = days.map(d => byDay[d] ?? 0);
  const max  = Math.max(...vals, 1);
  const today = days[6];
  return (
    <div className="flex items-end gap-1 h-10">
      {days.map((d, i) => {
        const h = Math.max(4, Math.round((vals[i] / max) * 40));
        const isToday = d === today;
        return (
          <div key={d} className="group relative flex-1 flex flex-col items-center justify-end">
            <div
              style={{ height: h }}
              className={`w-full rounded-sm transition-all ${isToday ? 'bg-emerald-400' : 'bg-slate-700 group-hover:bg-slate-500'}`}
            />
            {vals[i] > 0 && (
              <span className="absolute -top-4 text-[8px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {vals[i]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type FeedItem =
  | { kind: 'audit';  id: string; ts: string; severity: string; actor_email: string | null; action: string }
  | { kind: 'signup'; id: string; ts: string; email: string; source: string | null }
  | { kind: 'error';  id: string; ts: string; source: string; message: string };

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL:       'text-red-400',
  SECURITY_ALERT: 'text-red-400',
  WARNING:        'text-amber-400',
  INFO:           'text-slate-500',
};

function ActivityFeed({ data }: { data: CCData }) {
  const feed: FeedItem[] = [
    ...data.recentAudit.map(a => ({ kind: 'audit'  as const, id: a.id,  ts: a.created_at,  severity: a.severity, actor_email: a.actor_email, action: a.action })),
    ...data.recentWaitlist.map(w => ({ kind: 'signup' as const, id: w.id,  ts: w.created_at, email: w.email, source: w.source })),
    ...data.recentErrors.map(e => ({ kind: 'error'  as const, id: e.id,  ts: e.created_at, source: e.source, message: e.message })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 20);

  if (feed.length === 0) {
    return <p className="text-xs text-slate-600 font-mono py-8 text-center">No recent activity</p>;
  }

  return (
    <div className="space-y-0 divide-y divide-slate-800/60">
      {feed.map(item => (
        <div key={item.id} className="flex items-start gap-3 py-2.5 px-1">
          {item.kind === 'audit' && (
            <>
              <div className="mt-0.5 w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <span className="text-[10px]">📋</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{item.action}</p>
                <p className={`text-[10px] font-mono mt-0.5 ${SEVERITY_COLOR[item.severity] ?? 'text-slate-600'}`}>
                  {item.severity} · {item.actor_email ?? 'system'} · {timeAgo(item.ts)}
                </p>
              </div>
            </>
          )}
          {item.kind === 'signup' && (
            <>
              <div className="mt-0.5 w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <span className="text-[10px]">✦</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-400 truncate">{item.email}</p>
                <p className="text-[10px] font-mono text-slate-600 mt-0.5">
                  waitlist · {item.source ?? 'direct'} · {timeAgo(item.ts)}
                </p>
              </div>
            </>
          )}
          {item.kind === 'error' && (
            <>
              <div className="mt-0.5 w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <span className="text-[10px]">⚠</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-400 font-mono truncate">{item.source}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{item.message}</p>
                <p className="text-[10px] font-mono text-slate-700 mt-0.5">{timeAgo(item.ts)}</p>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function CommandCentreClient({ initialData }: { initialData: CCData }) {
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/command-center', { cache: 'no-store' });
      if (res.ok) { setData(await res.json()); setLastRefresh(Date.now()); }
    } finally { setLoading(false); }
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const { totalUsers, onboarded, foundingCount, newUsersWeek, dau,
          waitlistTotal, mrrPence, arrPence, activeSubs, trialingSubs,
          openTickets, inProgressTickets, slaBreaches,
          pendingGdpr, overdueGdpr, activeWorkflows, failedRunsWeek,
          sessionsToday, tierCounts, foundingGoal, signupsByDay,
          stripeOk, supabaseOk, emailConfigured, recentErrors,
          grantsPipelineValuePence, grantsSubmitted, grantsDeadlineSoon,
          runwayMonths, runwayZeroDate,
          roadmapInProgress, nextCriticalMilestone,
          nhsReadinessScore, icbPipelineCount } = data;

  const onboardedPct = pct(onboarded, totalUsers);
  const foundingPct  = Math.min(100, pct(foundingCount, foundingGoal));
  const alertCount   = slaBreaches + overdueGdpr + recentErrors.length + failedRunsWeek;
  const hasAlerts    = alertCount > 0;

  const secsSinceRefresh = Math.floor((Date.now() - lastRefresh) / 1000);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Command Centre</h1>
          <p className="text-slate-500 text-xs font-mono mt-1">
            Updated {secsSinceRefresh < 5 ? 'just now' : `${secsSinceRefresh}s ago`} · auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh} disabled={loading}
            className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors disabled:opacity-40"
          >
            {loading ? '↻ Refreshing…' : '↻ Refresh'}
          </button>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
            LIVE
          </span>
        </div>
      </div>

      {/* Alert banner */}
      {hasAlerts && (
        <div className="bg-red-500/8 border border-red-500/30 rounded-2xl px-5 py-4 flex flex-wrap gap-4 items-start">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-300 mb-2">Attention required</p>
            <div className="flex flex-wrap gap-3">
              {slaBreaches > 0 && (
                <Link href="/admin/tickets" className="text-[11px] font-mono text-red-400 hover:text-red-300 underline underline-offset-2">
                  {slaBreaches} ticket SLA {slaBreaches === 1 ? 'breach' : 'breaches'}
                </Link>
              )}
              {overdueGdpr > 0 && (
                <Link href="/admin/tickets/gdpr-requests" className="text-[11px] font-mono text-red-400 hover:text-red-300 underline underline-offset-2">
                  {overdueGdpr} GDPR {overdueGdpr === 1 ? 'request' : 'requests'} overdue
                </Link>
              )}
              {recentErrors.length > 0 && (
                <Link href="/admin/system" className="text-[11px] font-mono text-red-400 hover:text-red-300 underline underline-offset-2">
                  {recentErrors.length} system {recentErrors.length === 1 ? 'error' : 'errors'}
                </Link>
              )}
              {failedRunsWeek > 0 && (
                <Link href="/admin/workflows" className="text-[11px] font-mono text-red-400 hover:text-red-300 underline underline-offset-2">
                  {failedRunsWeek} workflow {failedRunsWeek === 1 ? 'failure' : 'failures'} (7d)
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System health */}
      <div className="flex flex-wrap gap-6 px-5 py-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
        <HealthPill label="Supabase" ok={supabaseOk} />
        <HealthPill label="Stripe" ok={stripeOk} />
        <HealthPill label="Email" ok={emailConfigured} />
        <HealthPill label={`${recentErrors.length === 0 ? 'No errors' : `${recentErrors.length} errors`}`} ok={recentErrors.length === 0} warn={recentErrors.length > 0} />
        <HealthPill label={`${activeWorkflows} workflows active`} ok={activeWorkflows > 0} warn={failedRunsWeek > 0} />
      </div>

      {/* Revenue KPIs */}
      <div>
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-3">Revenue</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="MRR" value={mrrPence > 0 ? gbp(mrrPence) : '—'} sub={`${gbp(arrPence)}/yr ARR`} color={mrrPence > 0 ? 'text-emerald-400' : 'text-slate-500'} />
          <KpiCard label="Active Subscriptions" value={activeSubs.toString()} sub={trialingSubs > 0 ? `+${trialingSubs} trialing` : 'no trials'} color="text-slate-900 dark:text-white" href="/admin/billing" />
          <KpiCard label="Waitlist" value={waitlistTotal.toLocaleString()} sub="total signups" color="text-sky-400" href="/admin/users" />
          <KpiCard label="Founding Members" value={foundingCount.toLocaleString()} sub={`${foundingGoal - foundingCount} slots left`} color="text-amber-400" href="/admin/users" />
        </div>
      </div>

      {/* User KPIs */}
      <div>
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-3">Users</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Users" value={totalUsers.toLocaleString()} sub={`+${newUsersWeek} this week`} color="text-slate-900 dark:text-white" href="/admin/users" />
          <KpiCard label="Daily Active (DAU)" value={dau.toString()} sub={`${sessionsToday} sessions today`} color="text-indigo-400" />
          <KpiCard label="Onboarded" value={`${onboardedPct}%`} sub={`${onboarded.toLocaleString()} users`} color={onboardedPct >= 60 ? 'text-emerald-400' : 'text-amber-400'} />
          <KpiCard label="Founding Progress" value={`${foundingPct}%`} sub={`${foundingCount} of ${foundingGoal}`} color="text-amber-400" />
        </div>
      </div>

      {/* Operations KPIs */}
      <div>
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-3">Operations</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Open Tickets" value={(openTickets + inProgressTickets).toString()} sub={`${openTickets} open · ${inProgressTickets} in progress`} color={openTickets > 0 ? 'text-amber-400' : 'text-slate-900 dark:text-white'} href="/admin/tickets" alert={slaBreaches > 0} />
          <KpiCard label="SLA Breaches" value={slaBreaches.toString()} sub="tickets past due" color={slaBreaches > 0 ? 'text-red-400' : 'text-slate-900 dark:text-white'} href="/admin/tickets" alert={slaBreaches > 0} />
          <KpiCard label="GDPR Queue" value={pendingGdpr.toString()} sub={overdueGdpr > 0 ? `${overdueGdpr} overdue` : 'all on time'} color={overdueGdpr > 0 ? 'text-red-400' : 'text-slate-900 dark:text-white'} href="/admin/tickets/gdpr-requests" alert={overdueGdpr > 0} />
          <KpiCard label="Workflow Failures" value={failedRunsWeek.toString()} sub="last 7 days" color={failedRunsWeek > 0 ? 'text-red-400' : 'text-slate-900 dark:text-white'} href="/admin/workflows" alert={failedRunsWeek > 0} />
        </div>
      </div>

      {/* Fundraising KPIs */}
      <div>
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-3">Fundraising</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Grants Pipeline" value={gbp(grantsPipelineValuePence)} sub={`${grantsSubmitted} submitted`} color="text-emerald-400" href="/admin/grants" />
          <KpiCard label="Deadline Soon" value={grantsDeadlineSoon.toString()} sub="within 30 days" color={grantsDeadlineSoon > 0 ? 'text-amber-400' : 'text-slate-900 dark:text-white'} href="/admin/grants" alert={grantsDeadlineSoon > 0} />
          <KpiCard label="Runway" value={runwayMonths !== null ? `${runwayMonths}mo` : '—'} sub={runwayZeroDate ? `zero ${runwayZeroDate}` : 'not configured'} color={runwayMonths !== null && runwayMonths < 6 ? 'text-red-400' : runwayMonths !== null && runwayMonths < 12 ? 'text-amber-400' : 'text-emerald-400'} href="/admin/venture" alert={runwayMonths !== null && runwayMonths < 6} />
          <KpiCard label="ICB Pipeline" value={icbPipelineCount.toString()} sub="engaged → contract" color="text-sky-400" href="/admin/nhs" />
        </div>
      </div>

      {/* NHS & Compliance KPIs */}
      <div>
        <p className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-3">NHS & Compliance</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="NHS Readiness" value={`${nhsReadinessScore}%`} sub="DCB0129 · DTAC · DSPT" color={nhsReadinessScore >= 80 ? 'text-emerald-400' : nhsReadinessScore >= 50 ? 'text-amber-400' : 'text-red-400'} href="/admin/compliance" />
          <KpiCard label="Roadmap In Progress" value={roadmapInProgress.toString()} sub={nextCriticalMilestone ? `next: ${nextCriticalMilestone.title.slice(0, 22)}` : 'no critical items'} color="text-indigo-400" href="/admin/roadmap" />
          <KpiCard label="Next Critical" value={nextCriticalMilestone?.target_date ?? '—'} sub={nextCriticalMilestone?.title.slice(0, 28) ?? 'no critical milestone'} color="text-purple-400" href="/admin/roadmap" />
          <KpiCard label="Evidence Pack" value="→" sub="clinical & commercial docs" color="text-slate-400" href="/admin/evidence" />
        </div>
      </div>

      {/* Signups sparkline + OKRs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Signup trend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900 dark:text-white">New Signups — last 7 days</p>
            <span className="text-xs font-mono text-slate-500">{newUsersWeek} total</span>
          </div>
          <Sparkline byDay={signupsByDay} />
          <div className="flex justify-between mt-2">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(Date.now() - (6 - i) * 86400_000);
              return <span key={i} className="text-[9px] font-mono text-slate-700 flex-1 text-center">{d.toLocaleDateString('en-GB', { weekday: 'narrow' })}</span>;
            })}
          </div>
        </div>

        {/* OKR milestones */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm font-bold text-slate-900 dark:text-white">OKR Milestones</p>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">TARGETS</span>
          </div>
          <div className="space-y-4">
            <OkrBar label="500 Founding Members" current={foundingCount} goal={foundingGoal}       color="bg-amber-400" />
            <OkrBar label="NHS Pilot Partner"     current={0}             goal={1}                  color="bg-sky-400" />
            <OkrBar label="App Store Launch"      current={0}             goal={1}                  color="bg-emerald-500" />
            <OkrBar label="1,000 Total Users"     current={totalUsers}    goal={1000}               color="bg-indigo-400" />
          </div>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <p className="text-sm font-bold text-slate-900 dark:text-white mb-4">Tier Distribution</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).map(([tier, count]) => {
            const tierP = pct(count, totalUsers);
            const colors: Record<string, string> = {
              founding: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
              standard: 'bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-600',
              public_funds: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
              vocali_freemium: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-700',
            };
            return (
              <div key={tier} className={`px-4 py-2.5 rounded-xl border ${colors[tier] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-700'}`}>
                <p className="text-[10px] font-mono uppercase tracking-wide">{tier.replace(/_/g, ' ')}</p>
                <p className="text-xl font-black mt-0.5">{count}</p>
                <p className="text-[9px] font-mono opacity-60">{tierP}%</p>
              </div>
            );
          })}
          {Object.keys(tierCounts).length === 0 && (
            <p className="text-xs text-slate-600 font-mono">No users yet</p>
          )}
        </div>
      </div>

      {/* Activity feed + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity feed */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Activity Feed</p>
            <Link href="/admin/audit" className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors">View audit log →</Link>
          </div>
          <div className="px-5 py-2 max-h-[500px] overflow-y-auto">
            <ActivityFeed data={data} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Quick actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
            <p className="text-sm font-bold text-slate-900 dark:text-white mb-3">Quick Links</p>
            <div className="space-y-1.5">
              {[
                { label: 'Support Queue',      href: '/admin/tickets',                badge: openTickets > 0 ? `${openTickets} open` : null,    badgeColor: 'bg-amber-500/10 text-amber-400' },
                { label: 'GDPR Requests',      href: '/admin/tickets/gdpr-requests',  badge: pendingGdpr > 0 ? `${pendingGdpr} pending` : null, badgeColor: 'bg-red-500/10 text-red-400' },
                { label: 'Grants',             href: '/admin/grants',                 badge: grantsDeadlineSoon > 0 ? `${grantsDeadlineSoon} due soon` : null, badgeColor: 'bg-amber-500/10 text-amber-400' },
                { label: 'Roadmap',            href: '/admin/roadmap',                badge: roadmapInProgress > 0 ? `${roadmapInProgress} active` : null, badgeColor: 'bg-indigo-500/10 text-indigo-400' },
                { label: 'Evidence Pack',      href: '/admin/evidence',               badge: null,                                               badgeColor: '' },
                { label: 'Notifications',      href: '/admin/notifications',          badge: null,                                               badgeColor: '' },
                { label: 'Users',              href: '/admin/users',                  badge: null,                                               badgeColor: '' },
                { label: 'Billing',            href: '/admin/billing',                badge: null,                                               badgeColor: '' },
                { label: 'Workflows',          href: '/admin/workflows',              badge: failedRunsWeek > 0 ? `${failedRunsWeek} failed` : null, badgeColor: 'bg-red-500/10 text-red-400' },
                { label: 'System',             href: '/admin/system',                 badge: recentErrors.length > 0 ? `${recentErrors.length} errors` : null, badgeColor: 'bg-red-500/10 text-red-400' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800/60 transition-colors group">
                  <span className="text-xs text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>{item.badge}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent waitlist signups */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Recent Signups</p>
            </div>
            {data.recentWaitlist.length === 0 ? (
              <p className="px-5 py-6 text-xs text-slate-600 font-mono text-center">No signups yet</p>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.recentWaitlist.map(w => (
                  <li key={w.id} className="px-5 py-2.5">
                    <p className="text-xs text-slate-900 dark:text-white truncate">{w.email}</p>
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5">{w.source ?? 'direct'} · {shortDate(w.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Errors */}
          {recentErrors.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-red-500/15">
                <p className="text-sm font-bold text-red-300">System Errors</p>
              </div>
              <ul className="divide-y divide-red-500/10">
                {recentErrors.map(e => (
                  <li key={e.id} className="px-5 py-2.5">
                    <p className="text-[10px] font-mono text-red-400 truncate">{e.source}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{e.message}</p>
                    <p className="text-[10px] font-mono text-slate-700 mt-0.5">{shortDate(e.created_at)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
