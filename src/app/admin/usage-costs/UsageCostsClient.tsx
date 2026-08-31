'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { UsageCostsData, UserPnL, TierRow, ServiceRow, ComputeData } from '@/app/api/admin/usage-costs/route';

const POLL_INTERVAL_MS = 30_000;

// ── Formatters ────────────────────────────────────────────────────────────────

function gbp(n: number, decimals = 2) {
  return n.toLocaleString('en-GB', {
    style: 'currency', currency: 'GBP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, n < 0.01 && n > 0 ? 4 : decimals),
  });
}
function pct(n: number) { return `${n.toFixed(1)}%`; }
function mins(secs: number) {
  if (secs < 60) return `${secs}s`;
  return `${(secs / 60).toFixed(1)}m`;
}
function relTime(iso: string | null): string {
  if (!iso) return 'Never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function shortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const TIER_CLS: Record<string, string> = {
  founding:        'bg-amber-500/10 text-amber-400 border-amber-500/30',
  standard:        'bg-slate-700/40 text-slate-400 border-slate-600/30',
  public_funds:    'bg-sky-500/10 text-sky-400 border-sky-500/30',
  vocali_freemium: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
};
const BILLING_CLS: Record<string, string> = {
  fixed:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
  variable: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  freemium: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};
const BILLING_LABEL: Record<string, string> = {
  fixed: 'Fixed', variable: 'Variable', freemium: 'Free tier',
};

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">{children}</h2>
      {right && <div className="text-xs text-slate-600">{right}</div>}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = 'text-slate-900 dark:text-white', icon, alert,
}: {
  label: string; value: string | number; sub?: string; color?: string; icon: string; alert?: 'warn' | 'good' | 'neutral';
}) {
  const alertCls = alert === 'warn' ? 'border-rose-500/30 bg-rose-500/5'
    : alert === 'good' ? 'border-emerald-500/20 bg-emerald-500/5'
    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40';
  return (
    <div className={`rounded-xl border p-5 ${alertCls}`}>
      <div className="text-xl mb-3">{icon}</div>
      <div className={`text-2xl font-extrabold tabular-nums leading-none ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1.5">{label}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-1 leading-relaxed">{sub}</div>}
    </div>
  );
}

// ── Service registry card ─────────────────────────────────────────────────────

function ServiceCard({ s }: { s: ServiceRow }) {
  const isFree = s.billing === 'freemium';
  const isVar  = s.billing === 'variable';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none w-6 text-center">{s.icon}</span>
          <div>
            <div className="text-sm font-semibold text-slate-200">{s.name}</div>
            <div className="text-[10px] text-slate-600">{s.category}</div>
          </div>
        </div>
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${BILLING_CLS[s.billing]}`}>
          {BILLING_LABEL[s.billing]}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          {isFree ? (
            <span className="text-sm font-bold text-emerald-400">£0.00</span>
          ) : (
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{gbp(s.totalGbp)}</span>
              <span className="text-[10px] text-slate-600 ml-1">/mo</span>
            </div>
          )}
          {!isFree && s.variableGbp > 0 && (
            <div className="text-[10px] text-amber-500/70 mt-0.5">
              +{gbp(s.variableGbp)} variable this month
            </div>
          )}
        </div>
        {s.usage && (
          <span className="text-[10px] text-slate-500 text-right">{s.usage}</span>
        )}
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed border-t border-slate-200 dark:border-slate-800/60 pt-2">{s.note}</p>
    </div>
  );
}

// ── Tier table ────────────────────────────────────────────────────────────────

function TierTable({ tiers }: { tiers: TierRow[] }) {
  const TIER_NAMES: Record<string, string> = {
    founding: '⭐ Founding', standard: '🔵 Standard', public_funds: '🏥 Funded', vocali_freemium: '⚪ Freemium',
  };
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <tr>
              {['Tier', 'Users', 'Sessions / mo', 'Audio / mo', 'Revenue / mo', 'Variable Cost', 'Fixed Share', 'Net P&L'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-mono font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {tiers.map(t => (
              <tr key={t.tier} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="font-semibold text-slate-200">{TIER_NAMES[t.tier] ?? t.tier}</span>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{t.users}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{t.sessionsMonth}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{mins(t.secondsMonth)}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium text-emerald-400">{gbp(t.revenueMonthPence / 100)}</td>
                <td className="px-4 py-2.5 tabular-nums text-amber-400/80">{gbp(t.variableCostGbp, 4)}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-400">{gbp(t.fixedShareGbp)}</td>
                <td className="px-4 py-2.5 tabular-nums font-bold">
                  <span className={t.pnlGbp >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {t.pnlGbp >= 0 ? '+' : ''}{gbp(t.pnlGbp)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Per-user P&L table ────────────────────────────────────────────────────────

type SortKey = keyof Pick<UserPnL, 'revenueMonthPence' | 'variableCostGbp' | 'pnlGbp' | 'sessionsMonth' | 'secondsMonth' | 'lastSessionAt'>;

function UserPnLTable({ users }: { users: UserPnL[] }) {
  const [sort, setSort] = useState<SortKey>('pnlGbp');
  const [desc, setDesc] = useState(true);
  const [q, setQ]       = useState('');

  function toggle(k: SortKey) {
    if (sort === k) setDesc(d => !d); else { setSort(k); setDesc(true); }
  }

  const filtered = users
    .filter(u => !q || u.email.toLowerCase().includes(q.toLowerCase()) || (u.displayName ?? '').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const av = a[sort] ?? 0, bv = b[sort] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') return desc ? bv.localeCompare(av) : av.localeCompare(bv);
      return desc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

  function Th({ col, label }: { col: SortKey; label: string }) {
    const a = sort === col;
    return (
      <th onClick={() => toggle(col)} className="px-4 py-2.5 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 cursor-pointer select-none hover:text-slate-300 transition-colors whitespace-nowrap">
        {label}{a ? (desc ? ' ↓' : ' ↑') : ''}
      </th>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/30">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search user…"
          className="w-full sm:max-w-xs bg-slate-100/80 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <tr>
              <th className="px-4 py-2.5 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">User</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Tier</th>
              <Th col="sessionsMonth"     label="Sessions" />
              <Th col="secondsMonth"      label="Audio" />
              <Th col="revenueMonthPence" label="Revenue" />
              <Th col="variableCostGbp"   label="Var. Cost" />
              <Th col="pnlGbp"            label="P&L" />
              <Th col="lastSessionAt"     label="Last Active" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-600 text-xs">No users found</td></tr>
            )}
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-slate-800/25 transition-colors group">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-200 text-sm truncate max-w-[180px]">{u.displayName ?? u.email.split('@')[0]}</div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  {u.tier ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${TIER_CLS[u.tier] ?? 'bg-slate-700/40 text-slate-400 border-slate-600/30'}`}>
                      {u.tier.toUpperCase()}
                    </span>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className="text-slate-200 font-medium">{u.sessionsMonth}</span>
                  <span className="text-slate-600 text-xs ml-1">/{u.sessionsTotal}</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-200">{mins(u.secondsMonth)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {u.revenueMonthPence > 0
                    ? <span className="text-emerald-400 font-bold text-xs">{gbp(u.revenueMonthPence / 100)}</span>
                    : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {u.variableCostGbp > 0
                    ? <span className="text-amber-400/80 text-xs">{gbp(u.variableCostGbp, 4)}</span>
                    : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  <span className={`font-bold text-sm ${u.pnlGbp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {u.pnlGbp >= 0 ? '+' : ''}{gbp(u.pnlGbp)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-400 text-xs">{relTime(u.lastSessionAt)}</span>
                  {u.lastSessionAt && <div className="text-[10px] text-slate-600">{shortDate(u.lastSessionAt)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-900/30 text-xs text-slate-600">
          {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ── Projected cost bar ────────────────────────────────────────────────────────

function RunRateBar({ label, current, projected, color }: { label: string; current: number; projected: number; color: string }) {
  const pct = projected > 0 ? Math.min((current / projected) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">{current} <span className="text-slate-600">→ {projected} projected</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Compute & Infrastructure section ─────────────────────────────────────────

function UtilBar({ label, used, total, unit, color }: { label: string; used: number; total: number; unit: string; color: string }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const health = pct > 80 ? 'text-rose-400' : pct > 60 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`font-mono tabular-nums ${health}`}>
          {used.toFixed(used < 1 ? 3 : 1)} / {total} {unit}
          <span className="text-slate-600 ml-1">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, sub, mono }: { label: string; value: string | number; sub?: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-200/60 dark:border-slate-800/40 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-semibold text-slate-200 ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</span>
        {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function ComputeSection({ c }: { c: ComputeData }) {
  const dbMb = (c.dbBytes / (1024 * 1024));
  const dbLimitMb = c.dbFreeTierLimitBytes / (1024 * 1024);

  return (
    <section className="space-y-6">
      <SectionLabel right="Live infrastructure metrics">Compute &amp; Infrastructure</SectionLabel>

      {/* Grid: 4 panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Vercel Compute */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">▲</span>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">Vercel Functions</h3>
            <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">HEALTHY</span>
          </div>
          <div className="space-y-0">
            <InfoRow label="Region"              value={c.vercelRegion} />
            <InfoRow label="Runtime"             value={c.nodeVersion} />
            <InfoRow label="Function memory"     value={`${c.functionMemoryMb.toLocaleString()} MB`} sub="per invocation" />
            <InfoRow label="Max timeout"         value={`${c.functionTimeoutS}s`} sub="Fluid Compute" />
            <InfoRow label="Function bundles"    value={c.functionTypes} sub="Node.js serverless" mono />
            <InfoRow label="Est. invocations/mo" value={c.estimatedInvocationsMonth.toLocaleString()} sub="middleware + SSR" mono />
            <InfoRow label="Est. bandwidth/mo"   value={`${c.estimatedBandwidthMb} MB`} sub={`~${((c.estimatedBandwidthMb / 1024 / 1024) * 100).toFixed(3)}% of 1 TB Pro limit`} mono />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-3">
            <UtilBar
              label="Bandwidth usage (1 TB limit)"
              used={c.estimatedBandwidthMb / 1024}
              total={1024}
              unit="GB"
              color="bg-sky-500"
            />
          </div>
        </div>

        {/* Database */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🗄</span>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">Supabase Postgres</h3>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
              c.dbUtilisationPct > 80 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              {c.dbUtilisationPct.toFixed(1)}% USED
            </span>
          </div>
          <div className="space-y-0">
            <InfoRow label="DB size"    value={`${dbMb.toFixed(1)} MB`} sub={`of ${(dbLimitMb / 1024).toFixed(0)} GB limit`} mono />
            <InfoRow label="Tables"     value={c.dbTableCount}          sub="public schema" mono />
            <InfoRow label="Region"     value="eu-west-2 (London)"      sub="data residency" />
            <InfoRow label="Auth"       value="Supabase Auth + RLS"     sub="row-level security enforced" />
            <InfoRow label="Connection" value="Supabase JS v2"          sub="service role (server-only)" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-3">
            <UtilBar label="DB storage" used={dbMb} total={dbLimitMb} unit="MB" color="bg-violet-500" />
            <UtilBar label="R2 audio storage" used={c.r2StorageGb} total={c.r2FreeTierGb} unit="GB" color="bg-amber-500" />
          </div>
        </div>

        {/* Traffic & CDN */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🌐</span>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">Traffic &amp; CDN</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Today',       value: c.pageViewsToday.toLocaleString(),  sub: 'page views' },
              { label: 'This week',   value: c.pageViewsWeek.toLocaleString(),   sub: 'page views' },
              { label: 'This month',  value: c.pageViewsMonth.toLocaleString(),  sub: 'page views' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-slate-100/60 dark:bg-slate-800/40 px-3 py-2.5 text-center">
                <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">{s.value}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-0">
            <InfoRow label="Unique sessions/mo" value={c.uniqueSessionsMonth.toLocaleString()} mono />
            <InfoRow label="CDN"                value="Vercel Edge Network"        sub="Anycast, 100+ PoPs" />
            <InfoRow label="Cache strategy"     value="Dynamic (low hit rate)"     sub="Admin: no-store · Marketing: PRERENDER" />
            <InfoRow label="SSL/TLS"            value="TLS 1.3"                    sub="auto-provisioned by Vercel" />
            <InfoRow label="DDoS protection"    value="Vercel Shield + BotID"      sub="included on Pro" />
          </div>
        </div>

        {/* Scheduled Jobs */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">⏱</span>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">Scheduled Jobs</h3>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
              c.cronSuccessRatePct === 100
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              {c.cronSuccessRatePct.toFixed(0)}% SUCCESS
            </span>
          </div>
          {/* Success / Failed / Total */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Total runs',  value: c.cronTotalRuns,   color: 'text-slate-900 dark:text-white' },
              { label: 'Successful',  value: c.cronSuccessful,  color: 'text-emerald-400' },
              { label: 'Failed',      value: c.cronFailed,      color: c.cronFailed > 0 ? 'text-rose-400' : 'text-slate-600' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-slate-100/60 dark:bg-slate-800/40 px-3 py-2.5 text-center">
                <div className={`text-base font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[9px] text-slate-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-0">
            <InfoRow label="Distinct jobs"   value={c.cronDistinctJobs}             mono />
            <InfoRow label="Avg duration"    value={`${Math.round(c.cronAvgDurationMs)}ms`} mono />
            <InfoRow label="Max duration"    value={`${c.cronMaxDurationMs}ms`}     mono />
            <InfoRow label="Last run"        value={relTime(c.cronLastRunAt)}        sub={c.cronLastRunAt ? shortDate(c.cronLastRunAt) : ''} />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/60">
            <UtilBar
              label="Success rate"
              used={c.cronSuccessRatePct}
              total={100}
              unit="%"
              color="bg-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Top tables by storage */}
      {c.topTables.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <span className="text-sm">📊</span>
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">Top Tables by Storage (Postgres)</h3>
            <span className="ml-auto text-[10px] text-slate-600">{dbMb.toFixed(1)} MB total · {c.dbTableCount} tables</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800/60">
                <tr>
                  <th className="px-5 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-slate-600">Table</th>
                  <th className="px-5 py-2 text-right text-[10px] font-mono uppercase tracking-widest text-slate-600">Size</th>
                  <th className="px-5 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-slate-600">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/30">
                {c.topTables.map((t, i) => {
                  const sharePct = c.dbBytes > 0 ? (t.bytes / c.dbBytes) * 100 : 0;
                  return (
                    <tr key={t.name} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-2 font-mono text-slate-600 dark:text-slate-300">
                        <span className="text-slate-600 mr-2 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                        {t.name}
                      </td>
                      <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-400">{t.pretty}</td>
                      <td className="px-5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden max-w-[80px]">
                            <div className="h-full rounded-full bg-violet-500/60" style={{ width: `${sharePct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-600 tabular-nums w-10 text-right">{sharePct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ASR Pipeline performance */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎙</span>
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">ASR Pipeline — Throughput</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Audio processed',    value: mins(c.audioTotalSeconds),     sub: `${(c.audioTotalSeconds / 60).toFixed(1)} minutes total` },
            { label: 'Sessions processed', value: c.audioSessionCount,            sub: 'all-time' },
            { label: 'Avg session length', value: mins(Math.round(c.avgSessionDurationS)), sub: 'per session' },
            { label: 'ASR latency',        value: 'Not yet logged',               sub: 'instrument average_latency_ms to enable' },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-slate-100/60 dark:bg-slate-800/40 px-4 py-3">
              <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">{m.value}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
              <div className="text-[10px] text-slate-600">{m.sub}</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/15 px-4 py-3 text-[11px] text-amber-500/80">
          <strong>Next:</strong> Instrument <code className="font-mono">average_latency_ms</code> in the ASR session writer to track real-time factor
          (target &lt; 0.5× for sub-500ms response latency). Once populated, P50/P95/P99 latency will appear here.
        </div>
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UsageCostsClient({ initialData }: { initialData: UsageCostsData }) {
  const [data, setData]       = useState<UsageCostsData>(initialData);
  const [lastFetch, setLast]  = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/admin/usage-costs', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLast(new Date());
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refresh]);

  const d  = data;
  const ec = d.economics;
  const totalServices = d.services.reduce((a, s) => a + s.totalGbp, 0);

  return (
    <div className="space-y-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Usage &amp; Costs</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time financial intelligence — revenue, operating costs, unit economics and per-user P&amp;L.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 border border-slate-700/60">
            <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-xs font-mono text-slate-400">{loading ? 'Refreshing…' : `Updated ${relTime(lastFetch.toISOString())}`}</span>
          </div>
          <button onClick={refresh} disabled={loading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 hover:border-slate-500 transition-colors disabled:opacity-40">
            ↻ Refresh
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          Refresh failed: {err} — showing last known data
        </div>
      )}

      {/* ── Financial health ─────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Financial Health</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon="💷" label="Monthly Recurring Revenue" value={gbp(ec.mrr)} color="text-emerald-400"
            sub={`ARR ${gbp(ec.arr)} · ${ec.activeSubs} active sub${ec.activeSubs !== 1 ? 's' : ''}`}
            alert={ec.mrr > 0 ? 'good' : 'neutral'} />
          <KpiCard icon="🔥" label="Monthly Burn Rate" value={gbp(ec.burnRateGbp)} color={ec.burnRateGbp > 0 ? 'text-rose-400' : 'text-emerald-400'}
            sub={`Total costs: ${gbp(d.totalCostGbp)} · Revenue: ${gbp(ec.mrr)}`}
            alert={ec.burnRateGbp > 200 ? 'warn' : ec.burnRateGbp > 0 ? 'neutral' : 'good'} />
          <KpiCard icon="📈" label="Gross Margin" value={pct(ec.grossMarginPct)} color={ec.grossMarginPct > 50 ? 'text-emerald-400' : ec.grossMarginPct > 20 ? 'text-amber-400' : 'text-rose-400'}
            sub={`Var. costs ${gbp(d.totalVariableGbp)} vs MRR ${gbp(ec.mrr)}`}
            alert={ec.grossMarginPct > 50 ? 'good' : ec.grossMarginPct > 0 ? 'neutral' : 'warn'} />
          <KpiCard icon="⚖️" label="Break-even" value={`${ec.breakEvenUsers === 999 ? '∞' : ec.breakEvenUsers} users`} color="text-slate-900 dark:text-white"
            sub={`ARPU ${gbp(ec.arpu)} · Fixed costs ${gbp(d.totalFixedGbp)}/mo`} />
        </div>
      </section>

      {/* ── Usage snapshot ───────────────────────────────────────────────────── */}
      <section>
        <SectionLabel right={`${d.dau} DAU · ${d.wau} WAU · ${d.mau} MAU`}>Usage Snapshot</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: '⚡', label: 'Sessions today',  value: d.sessionsToday,      color: 'text-slate-900 dark:text-white' },
            { icon: '📅', label: 'Sessions / month', value: d.sessionsMonth,     color: 'text-slate-900 dark:text-white' },
            { icon: '🎙', label: 'Audio today',      value: mins(d.secondsToday), color: 'text-sky-400' },
            { icon: '🎙', label: 'Audio this month', value: mins(d.secondsMonth), color: 'text-sky-400' },
            { icon: '👥', label: 'Total users',      value: d.totalUsers,         color: 'text-slate-900 dark:text-white' },
            { icon: '📧', label: 'Emails sent / mo', value: d.emailsSentMonth,    color: 'text-slate-600 dark:text-slate-300' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-4 py-4">
              <div className="text-lg mb-2">{c.icon}</div>
              <div className={`text-xl font-extrabold tabular-nums ${c.color}`}>{c.value}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Run-rate projections ─────────────────────────────────────────────── */}
      <section>
        <SectionLabel>End-of-Month Projections (Run Rate)</SectionLabel>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-6 space-y-5">
          <RunRateBar label="Sessions" current={d.sessionsMonth} projected={d.projectedSessions} color="bg-sky-500" />
          <RunRateBar label="Audio minutes" current={Math.round(d.secondsMonth / 60)} projected={Math.round(d.projectedSeconds / 60)} color="bg-emerald-500" />
          <RunRateBar
            label="Variable costs"
            current={parseFloat(gbp(d.totalVariableGbp, 4).replace(/[£,]/g, ''))}
            projected={parseFloat(gbp((d.projectedSeconds / 60) * 0.003 + d.projectedSessions * 0.002 + d.totalVariableGbp - (d.secondsMonth / 60) * 0.003 - d.sessionsMonth * 0.002, 4).replace(/[£,]/g, ''))}
            color="bg-amber-500"
          />
          <p className="text-[10px] text-slate-600 pt-2 border-t border-slate-200 dark:border-slate-800/60">
            Based on current month run rate. Fixed costs ({gbp(d.totalFixedGbp)}/mo) excluded from projection — they are constant.
          </p>
        </div>
      </section>

      {/* ── Service registry ─────────────────────────────────────────────────── */}
      <section>
        <SectionLabel right={`${d.services.length} services · total ${gbp(totalServices)}/mo`}>
          Service Cost Registry
        </SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {d.services.map(s => <ServiceCard key={s.id} s={s} />)}
        </div>

        {/* Cost allocation bar */}
        <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
          <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-4">Cost Allocation — This Month</h3>
          <div className="space-y-3">
            {d.services
              .filter(s => s.totalGbp > 0)
              .sort((a, b) => b.totalGbp - a.totalGbp)
              .map(s => {
                const pct = totalServices > 0 ? (s.totalGbp / totalServices) * 100 : 0;
                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{s.icon} {s.name}</span>
                      <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">{gbp(s.totalGbp)} <span className="text-slate-600">({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-sm">
            <span className="text-slate-500">Monthly total</span>
            <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">{gbp(totalServices)}</span>
          </div>
        </div>
      </section>

      {/* ── Unit economics ────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Unit Economics</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'ARPU', value: gbp(ec.arpu), sub: 'Avg revenue per paying user/mo', color: 'text-emerald-400' },
            { label: '12-Month LTV', value: gbp(ec.ltv12), sub: 'ARPU × 12 (no churn factor)', color: 'text-emerald-400' },
            { label: 'Cost / User / Mo', value: gbp(ec.avgVariableCostPerUser, 4), sub: 'Variable costs / MAU', color: 'text-amber-400' },
            { label: 'Cost / Session', value: gbp(ec.costPerSession, 4), sub: 'Variable only (ASR + AI)', color: 'text-amber-400' },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5">
              <div className={`text-xl font-extrabold tabular-nums ${m.color}`}>{m.value}</div>
              <div className="text-xs text-slate-400 mt-1">{m.label}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Cost vs revenue per session */}
        {ec.revenuePerSession > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-5 flex items-center gap-6">
            <div className="flex-1">
              <div className="text-xs text-slate-500 mb-1">Revenue per session</div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums">{gbp(ec.revenuePerSession, 4)}</div>
            </div>
            <div className="text-slate-700 text-xl">vs</div>
            <div className="flex-1">
              <div className="text-xs text-slate-500 mb-1">Cost per session (variable)</div>
              <div className="text-lg font-bold text-amber-400 tabular-nums">{gbp(ec.costPerSession, 4)}</div>
            </div>
            <div className="text-slate-700 text-xl">=</div>
            <div className="flex-1">
              <div className="text-xs text-slate-500 mb-1">Contribution margin / session</div>
              <div className={`text-lg font-bold tabular-nums ${ec.revenuePerSession - ec.costPerSession >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {gbp(ec.revenuePerSession - ec.costPerSession, 4)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Tier breakdown ────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel right={`${d.tiers.length} tier${d.tiers.length !== 1 ? 's' : ''}`}>Tier Analysis — P&amp;L by Segment</SectionLabel>
        <TierTable tiers={d.tiers} />
        <p className="text-[10px] text-slate-700 mt-2">
          Fixed share = infrastructure costs (£{d.totalFixedGbp.toFixed(2)}/mo) amortised equally across all {d.totalUsers} users.
          Variable cost = ASR + AI inference for that tier&apos;s sessions this month.
        </p>
      </section>

      {/* ── Per-user P&L ─────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel right={`${d.totalUsers} users`}>Per-User P&amp;L — This Month</SectionLabel>
        <UserPnLTable users={d.users} />
        <p className="text-[10px] text-slate-700 mt-2">
          P&amp;L = subscription revenue − variable compute costs − amortised infrastructure share.
          Cost estimates (ASR, AI) are variable approximations. All data is admin-only via service role.
        </p>
      </section>

      {/* ── Compute & Infrastructure ─────────────────────────────────────────── */}
      <ComputeSection c={d.compute} />

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <p className="text-center text-[10px] text-slate-800 pb-4">
        Auto-refreshes every 30s · Admin-only · Service role · Variable costs are estimates · Fixed costs from actual subscription prices
      </p>
    </div>
  );
}
