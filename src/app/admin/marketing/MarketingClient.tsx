'use client';

/**
 * Marketing Intelligence — 8-tab admin dashboard.
 *
 * Tabs: Overview | Paid Media | Attribution | Campaigns | Creatives |
 *       Social | Recommendations | Tracking Health
 *
 * Each tab fetches its own data lazily on first switch.
 * Source of truth: Supabase for users/product, Stripe for payments,
 * ad platforms for spend/engagement (via ad_platform_stats + social tables).
 *
 * ⚠ Approval-first: no external changes are made automatically.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',         label: 'Overview' },
  { id: 'paid_media',       label: 'Paid Media' },
  { id: 'attribution',      label: 'Attribution' },
  { id: 'campaigns',        label: 'Campaigns' },
  { id: 'creatives',        label: 'Creatives' },
  { id: 'social',           label: 'Social' },
  { id: 'recommendations',  label: 'Recommendations' },
  { id: 'tracking_health',  label: 'Tracking Health' },
] as const;

type TabId = typeof TABS[number]['id'];

// ── Generic hooks ─────────────────────────────────────────────────────────────

function useSection<T>(section: string, active: boolean) {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/marketing?section=${section}`);
      const json = await res.json() as T;
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    if (active && !data && !loading) fetch_();
  }, [active, data, loading, fetch_]);

  return { data, loading, error, refresh: fetch_ };
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>
  );
}

function SectionError({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500 font-mono">{msg}</div>
  );
}

function Stat({
  label, value, sub, valueClass = 'text-slate-900 dark:text-white',
  note,
}: {
  label: string; value: string; sub?: string; valueClass?: string; note?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">{label}</span>
      <span className={`text-2xl font-bold leading-none tabular-nums ${valueClass}`}>{value}</span>
      {sub  && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
      {note && <span className="text-[10px] text-slate-400 dark:text-slate-500 italic leading-snug">{note}</span>}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="text-center py-12 text-slate-400 dark:text-slate-600 text-sm">{msg}</div>
  );
}

function Badge({ label, color }: { label: string; color: 'green' | 'amber' | 'red' | 'slate' | 'violet' }) {
  const cls = {
    green:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    amber:  'bg-amber-500/10  text-amber-600  dark:text-amber-400  border-amber-500/20',
    red:    'bg-red-500/10    text-red-600    dark:text-red-400    border-red-500/20',
    slate:  'bg-slate-500/10  text-slate-500  dark:text-slate-400  border-slate-500/20',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  }[color];
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${cls}`}>
      {label}
    </span>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

type OverviewData = {
  funnel: { stage: string; count: number; note: string }[];
  totalSpendGBP: string;
  waitlistCPAPence: number | null;
  activatedCPAPence: number | null;
  trueCAC_pence: number | null;
  waitlistCPALabel: string;
  activatedCPALabel: string;
  trueCACLabel: string;
  baseline: { note: string; spendGBP: string; waitlistUsers: number; observedCPA: string };
  activeCampaigns: number;
  lastSyncAt: string | null;
};

function OverviewTab({ active }: { active: boolean }) {
  const { data, loading, error } = useSection<OverviewData>('overview', active);

  if (loading) return <Spinner />;
  if (error)   return <SectionError msg={error} />;
  if (!data)   return null;

  const funnelMax = Math.max(...data.funnel.map(f => f.count), 1);

  return (
    <div className="space-y-8">
      {/* Baseline callout */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-1">
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400">Early Observed Baseline</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          £{data.baseline.spendGBP} spend · {data.baseline.waitlistUsers} waitlist sign-ups ·
          <span className="font-bold"> ~£{data.baseline.observedCPA} waitlist CPA</span>
        </p>
        <p className="text-[11px] text-slate-400 italic">{data.baseline.note}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Total Ad Spend" value={`£${data.totalSpendGBP}`} sub="all time" />
        <Stat
          label={data.waitlistCPALabel}
          value={data.waitlistCPAPence != null ? `£${(data.waitlistCPAPence / 100).toFixed(2)}` : '—'}
          sub="spend ÷ waitlist sign-ups"
          note="Not CAC — users have not paid"
          valueClass={data.waitlistCPAPence != null ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}
        />
        <Stat
          label={data.activatedCPALabel}
          value={data.activatedCPAPence != null ? `£${(data.activatedCPAPence / 100).toFixed(2)}` : '—'}
          sub="spend ÷ users with ≥1 session"
        />
        <Stat
          label={data.trueCACLabel}
          value={data.trueCAC_pence != null ? `£${(data.trueCAC_pence / 100).toFixed(2)}` : '—'}
          sub="spend ÷ paying subscribers"
          note="The only metric that is CAC"
          valueClass={data.trueCAC_pence != null ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}
        />
      </div>

      {/* Funnel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Customer Journey Funnel</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Ad → Click → Landing Page → Waitlist → Account → Onboarding → First Session → Activated → Paid</p>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data.funnel}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 140, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.08} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={130} />
              <Tooltip
                formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Count']}
                contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.funnel.map((_, i) => (
                  <Cell
                    key={i}
                    fill={`hsl(${160 - i * 10} 70% ${45 + i * 2}%)`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3">
            {data.funnel.map((f, i) => {
              const conv = i > 0 && data.funnel[i - 1].count > 0
                ? Math.round((f.count / data.funnel[i - 1].count) * 100) : null;
              return conv !== null ? (
                <span key={f.stage} className={`text-[10px] font-mono ${conv < 30 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {f.stage}: {conv}% from prev
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Meta sync status */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className={`w-2 h-2 rounded-full ${data.lastSyncAt ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        {data.lastSyncAt
          ? `Ad data last synced: ${new Date(data.lastSyncAt).toLocaleString('en-GB')}`
          : 'Ad platform data not yet synced — use Campaigns tab to sync from Meta'}
        <span>· {data.activeCampaigns} active campaign{data.activeCampaigns !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// ── Tab: Paid Media ───────────────────────────────────────────────────────────

type PaidMediaData = {
  platforms: {
    platform: string; spendGBP: string; spendPence: number;
    impressions: number; reach: number; clicks: number; linkClicks: number;
    ctr: string | null; cpcGBP: string | null; cpmGBP: string | null;
  }[];
  totalSpendGBP: string;
  dailySpend: Record<string, number>;
  metrics: {
    waitlistCPA: { label: string; valueGBP: string | null; note: string; sampleSize: number };
    activatedCPA: { label: string; valueGBP: string | null; note: string; sampleSize: number };
    trueCAC: { label: string; valueGBP: string | null; note: string; sampleSize: number };
  };
  baseline: { note: string; spendGBP: string; waitlistUsers: number; cpaGBP: string };
  supportedPlatforms: string[];
  activePlatforms: string[];
};

const PLATFORM_ICONS: Record<string, string> = {
  meta: '🎯', google: '🔍', tiktok: '🎵',
};

function PaidMediaTab({ active }: { active: boolean }) {
  const { data, loading, error } = useSection<PaidMediaData>('paid_media', active);

  if (loading) return <Spinner />;
  if (error)   return <SectionError msg={error} />;
  if (!data)   return null;

  const metaRow = data.platforms.find(p => p.platform === 'meta');

  return (
    <div className="space-y-8">
      {/* Baseline banner */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mb-1">Early Campaign Baseline (small sample — not statistically significant)</p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          £{data.baseline.spendGBP} spend · {data.baseline.waitlistUsers} waitlist · ~£{data.baseline.cpaGBP} <span className="font-bold">waitlist CPA</span>
        </p>
        <p className="text-[11px] text-slate-400 mt-1 italic">{data.baseline.note}</p>
      </div>

      {/* CPA metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.values(data.metrics).map(m => (
          <div key={m.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">{m.label}</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {m.valueGBP ? `£${m.valueGBP}` : <span className="text-slate-400">—</span>}
            </p>
            <p className="text-[11px] text-slate-400 leading-snug">{m.note}</p>
            <p className="text-[10px] text-slate-400 font-mono">n = {m.sampleSize}</p>
            {m.sampleSize < 50 && (
              <Badge label="Insufficient data for confidence" color="amber" />
            )}
          </div>
        ))}
      </div>

      {/* Platform breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Platform Breakdown</h3>

        {/* Active platforms */}
        {data.platforms.map(p => (
          <div key={p.platform} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">{PLATFORM_ICONS[p.platform] ?? '📊'}</span>
              <h4 className="font-semibold text-slate-900 dark:text-white capitalize">{p.platform}</h4>
              <Badge label="Active" color="green" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: 'Spend',       value: `£${p.spendGBP}` },
                { label: 'Impressions', value: p.impressions.toLocaleString() },
                { label: 'Reach',       value: p.reach.toLocaleString() },
                { label: 'Clicks',      value: p.clicks.toLocaleString() },
                { label: 'CTR',         value: p.ctr ? `${p.ctr}%` : '—' },
                { label: 'CPC',         value: p.cpcGBP ? `£${p.cpcGBP}` : '—' },
                { label: 'CPM',         value: p.cpmGBP ? `£${p.cpmGBP}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Placeholder platforms */}
        {data.supportedPlatforms
          .filter(p => !data.activePlatforms.includes(p))
          .map(p => (
            <div key={p} className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-3 opacity-60">
              <span className="text-xl">{PLATFORM_ICONS[p] ?? '📊'}</span>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400 capitalize">{p}</p>
                <p className="text-xs text-slate-400">Architecture ready — sync not yet configured</p>
              </div>
              <Badge label="Coming soon" color="slate" />
            </div>
          ))}
      </div>

      {/* Daily spend chart */}
      {Object.keys(data.dailySpend).length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Daily Spend — last 30 days</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart
              data={Object.entries(data.dailySpend)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, pence]) => ({ date: date.slice(5), spend: +(pence / 100).toFixed(2) }))}
              margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `£${v}`} />
              <Tooltip
                formatter={(v) => [typeof v === 'number' ? `£${v.toFixed(2)}` : v, 'Spend']}
                contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="spend" stroke="#8b5cf6" strokeWidth={2} fill="url(#spendGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform spend comparison chart */}
      {data.platforms.length > 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Spend by platform</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={data.platforms.map(p => ({ platform: p.platform, spend: +p.spendGBP }))} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.07} />
              <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `£${v}`} />
              <Tooltip formatter={(v) => [typeof v === 'number' ? `£${v.toFixed(2)}` : v, 'Spend']} contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="spend" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {metaRow && (
        <p className="text-xs text-slate-400 font-mono text-center">
          Total spend all time: £{data.totalSpendGBP} · Sync from Meta to update
        </p>
      )}
    </div>
  );
}

// ── Tab: Attribution ──────────────────────────────────────────────────────────

type AttributionData = {
  totalRows: number; attributed: number; converted: number; unattributed: number;
  bySource: { source: string; clicks: number; conversions: number }[];
  byCampaign: { campaign: string; clicks: number; conversions: number }[];
  recentSamples: {
    source: string | null; medium: string | null; campaign: string | null;
    hasClickId: boolean; landingPage: string | null; firstSeen: string;
    converted: boolean; conversionType: string | null; linked: boolean;
  }[];
  utmCoveragePercent: number | null;
  note: string;
};

function AttributionTab({ active }: { active: boolean }) {
  const { data, loading, error } = useSection<AttributionData>('attribution', active);

  if (loading) return <Spinner />;
  if (error)   return <SectionError msg={error} />;
  if (!data)   return null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Attribution rows"  value={String(data.totalRows)} />
        <Stat label="Linked to user"   value={String(data.attributed)} />
        <Stat label="Converted"        value={String(data.converted)} sub="conversion_type set" />
        <Stat
          label="UTM coverage"
          value={data.utmCoveragePercent != null ? `${data.utmCoveragePercent}%` : '—'}
          sub="visitor sessions with utm_source"
          valueClass={data.utmCoveragePercent != null && data.utmCoveragePercent < 70
            ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
        />
      </div>

      <div className="text-xs text-slate-400 italic rounded-lg border border-slate-100 dark:border-slate-800 px-4 py-3">{data.note}</div>

      {/* Attribution coverage breakdown — horizontal stacked bar */}
      {data.totalRows > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Attribution funnel</h3>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart
              layout="vertical"
              data={[{
                name: 'Users',
                converted:    data.converted,
                linked:       data.attributed - data.converted,
                unattributed: data.unattributed,
              }]}
              margin={{ top: 0, right: 8, left: 60, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={52} />
              <Tooltip
                formatter={(v, name) => [
                  typeof v === 'number' ? v.toLocaleString() : v,
                  name === 'converted' ? 'Converted' : name === 'linked' ? 'Linked (not converted)' : 'Unattributed',
                ]}
                contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="converted"    stackId="a" fill="#10b981" radius={[4, 0, 0, 4]} />
              <Bar dataKey="linked"       stackId="a" fill="#6366f1" />
              <Bar dataKey="unattributed" stackId="a" fill="#94a3b8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Converted ({data.converted})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Linked, not converted ({data.attributed - data.converted})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" />Unattributed ({data.unattributed})</span>
          </div>
        </div>
      )}

      {/* Clicks vs conversions by source */}
      {data.bySource.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Clicks vs conversions by source</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, data.bySource.length * 44)}>
            <BarChart
              layout="vertical"
              data={[...data.bySource].sort((a, b) => b.clicks - a.clicks)}
              margin={{ top: 0, right: 40, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.07} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="source" tick={{ fontSize: 11 }} width={76} />
              <Tooltip
                formatter={(v, name) => [
                  typeof v === 'number' ? v.toLocaleString() : v,
                  name === 'clicks' ? 'Clicks' : 'Conversions',
                ]}
                contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="clicks"      fill="#6366f1" radius={[0, 2, 2, 0]} barSize={10} />
              <Bar dataKey="conversions" fill="#10b981" radius={[0, 2, 2, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Clicks</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Conversions</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By source */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">First-touch source</h3>
          </div>
          {data.bySource.length === 0
            ? <EmptyState msg="No attribution data yet" />
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-2 text-left text-[10px] font-mono uppercase text-slate-400">Source</th>
                    <th className="px-5 py-2 text-right text-[10px] font-mono uppercase text-slate-400">Clicks</th>
                    <th className="px-5 py-2 text-right text-[10px] font-mono uppercase text-slate-400">Converted</th>
                    <th className="px-5 py-2 text-right text-[10px] font-mono uppercase text-slate-400">CVR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.bySource.map(s => (
                    <tr key={s.source} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{s.source}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-xs">{s.clicks}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-xs text-emerald-600 dark:text-emerald-400">{s.conversions}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-xs text-slate-400">
                        {s.clicks > 0 ? `${Math.round((s.conversions / s.clicks) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* By campaign */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top campaigns (by conversions)</h3>
          </div>
          {data.byCampaign.length === 0
            ? <EmptyState msg="No campaign UTM data yet" />
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-2 text-left text-[10px] font-mono uppercase text-slate-400">Campaign</th>
                    <th className="px-5 py-2 text-right text-[10px] font-mono uppercase text-slate-400">Clicks</th>
                    <th className="px-5 py-2 text-right text-[10px] font-mono uppercase text-slate-400">Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.byCampaign.slice(0, 10).map(c => (
                    <tr key={c.campaign} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-2 font-mono text-xs text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{c.campaign}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-xs">{c.clicks}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-xs text-emerald-600 dark:text-emerald-400">{c.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Recent attribution samples */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent attribution records (first-touch)</h3>
        </div>
        {data.recentSamples.length === 0
          ? <EmptyState msg="No attribution records yet" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                    <th className="px-4 py-2 text-left">First seen</th>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Campaign</th>
                    <th className="px-4 py-2 text-left">Landing</th>
                    <th className="px-4 py-2 text-center">Click ID</th>
                    <th className="px-4 py-2 text-center">Linked</th>
                    <th className="px-4 py-2 text-center">Converted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentSamples.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 font-mono whitespace-nowrap">{new Date(s.firstSeen).toLocaleDateString('en-GB')}</td>
                      <td className="px-4 py-2 font-mono">{s.source ?? '—'}</td>
                      <td className="px-4 py-2 max-w-[160px] truncate">{s.campaign ?? '—'}</td>
                      <td className="px-4 py-2 max-w-[120px] truncate text-slate-400">{s.landingPage ?? '—'}</td>
                      <td className="px-4 py-2 text-center">{s.hasClickId ? '✓' : '—'}</td>
                      <td className="px-4 py-2 text-center">{s.linked ? <span className="text-emerald-500">✓</span> : '—'}</td>
                      <td className="px-4 py-2 text-center">{s.converted ? <span className="text-emerald-500">✓</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

// ── Tab: Campaigns ────────────────────────────────────────────────────────────

type CampaignsData = {
  campaigns: {
    campaignId: string; campaignName: string | null; platform: string;
    spendGBP: string; impressions: number; reach: number; clicks: number; linkClicks: number;
    ctr: string | null; cpcGBP: string | null; cpmGBP: string | null;
    dateRange: { from: string; to: string } | null;
  }[];
  lastSyncAt: string | null;
  totalRows: number;
};

function CampaignsTab({ active }: { active: boolean }) {
  const { data, loading, error, refresh } = useSection<CampaignsData>('campaigns', active);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const syncMeta = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res  = await fetch('/api/admin/marketing/sync', { method: 'POST' });
      const json = await res.json() as { synced?: number; error?: string; hint?: string; configured?: boolean };
      if (json.error) {
        setSyncResult(`Error: ${json.error}${json.hint ? ` — ${json.hint}` : ''}`);
      } else {
        setSyncResult(`Synced ${json.synced} rows from Meta`);
        refresh();
      }
    } catch (e) {
      setSyncResult(`Network error: ${String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <Spinner />;
  if (error)   return <SectionError msg={error} />;
  if (!data)   return null;

  return (
    <div className="space-y-6">
      {/* Sync controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-slate-400">
            {data.lastSyncAt
              ? `Last synced: ${new Date(data.lastSyncAt).toLocaleString('en-GB')}`
              : 'No ad data synced yet — click Sync to pull from Meta'}
          </p>
          {syncResult && (
            <p className={`text-xs mt-1 ${syncResult.startsWith('Error') ? 'text-red-500' : 'text-emerald-500'}`}>
              {syncResult}
            </p>
          )}
        </div>
        <button
          onClick={syncMeta}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
        >
          {syncing ? (
            <><div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Syncing…</>
          ) : (
            'Sync from Meta ↓'
          )}
        </button>
      </div>

      {data.campaigns.length === 0
        ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center space-y-3">
            <p className="text-slate-600 dark:text-slate-400 font-semibold">No campaign data</p>
            <p className="text-sm text-slate-400">
              Add <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">META_ADS_ACCESS_TOKEN</code> and <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">META_AD_ACCOUNT_ID</code> to Vercel env vars, then click Sync.
            </p>
          </div>
        )
        : (<>
          {/* Spend per campaign — horizontal bar */}
          {(() => {
            const chartData = [...data.campaigns]
              .sort((a, b) => parseFloat(b.spendGBP) - parseFloat(a.spendGBP))
              .slice(0, 10)
              .map(c => ({
                name:   (c.campaignName ?? c.campaignId).slice(0, 28) + ((c.campaignName ?? c.campaignId).length > 28 ? '…' : ''),
                spend:  parseFloat(c.spendGBP),
                clicks: c.clicks,
              }));
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Spend */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Spend by campaign</h3>
                  <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 36)}>
                    <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 48, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.07} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `£${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={160} />
                      <Tooltip
                        formatter={(v) => [typeof v === 'number' ? `£${v.toFixed(2)}` : v, 'Spend']}
                        contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="spend" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Clicks */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Clicks by campaign</h3>
                  <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 36)}>
                    <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 48, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.07} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={160} />
                      <Tooltip
                        formatter={(v) => [typeof v === 'number' ? v.toLocaleString() : v, 'Clicks']}
                        contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="clicks" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}
        </>)}

      {data.campaigns.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                    <th className="px-5 py-3 text-left">Campaign</th>
                    <th className="px-5 py-3 text-left">Platform</th>
                    <th className="px-5 py-3 text-right">Spend</th>
                    <th className="px-5 py-3 text-right">Impr.</th>
                    <th className="px-5 py-3 text-right">Clicks</th>
                    <th className="px-5 py-3 text-right">CTR</th>
                    <th className="px-5 py-3 text-right">CPC</th>
                    <th className="px-5 py-3 text-right">CPM</th>
                    <th className="px-5 py-3 text-right">Dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.campaigns.map(c => (
                    <tr key={`${c.platform}::${c.campaignId}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 max-w-[200px] truncate font-medium text-slate-900 dark:text-white" title={c.campaignName ?? c.campaignId}>
                        {c.campaignName ?? c.campaignId}
                      </td>
                      <td className="px-5 py-3 capitalize text-slate-500">{c.platform}</td>
                      <td className="px-5 py-3 text-right font-mono">£{c.spendGBP}</td>
                      <td className="px-5 py-3 text-right font-mono">{c.impressions.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right font-mono">{c.clicks.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right font-mono">{c.ctr ?? '—'}</td>
                      <td className="px-5 py-3 text-right font-mono">{c.cpcGBP ? `£${c.cpcGBP}` : '—'}</td>
                      <td className="px-5 py-3 text-right font-mono">{c.cpmGBP ? `£${c.cpmGBP}` : '—'}</td>
                      <td className="px-5 py-3 text-right text-[10px] text-slate-400 font-mono whitespace-nowrap">
                        {c.dateRange ? `${c.dateRange.from} → ${c.dateRange.to}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}
    </div>
  );
}

// ── Tab: Creatives ────────────────────────────────────────────────────────────

type CreativesData = {
  creatives: {
    adId: string; adName: string | null; creativeId: string | null; platform: string;
    spendGBP: string; impressions: number; clicks: number; linkClicks: number;
    ctr: string | null; cpcGBP: string | null;
  }[];
};

function CreativesTab({ active }: { active: boolean }) {
  const { data, loading, error } = useSection<CreativesData>('creatives', active);

  if (loading) return <Spinner />;
  if (error)   return <SectionError msg={error} />;
  if (!data || data.creatives.length === 0) return (
    <EmptyState msg="No creative data yet. Sync campaign data from Meta in the Campaigns tab." />
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Creative performance (by ad)</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Ranked by spend. Creative IDs link to Meta Ads Manager.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                <th className="px-5 py-3 text-left">Ad name</th>
                <th className="px-5 py-3 text-left">Creative ID</th>
                <th className="px-5 py-3 text-right">Spend</th>
                <th className="px-5 py-3 text-right">Impr.</th>
                <th className="px-5 py-3 text-right">Clicks</th>
                <th className="px-5 py-3 text-right">CTR</th>
                <th className="px-5 py-3 text-right">CPC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.creatives.map(c => (
                <tr key={c.adId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white max-w-[200px] truncate">{c.adName ?? c.adId}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400 max-w-[120px] truncate">{c.creativeId ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-mono">£{c.spendGBP}</td>
                  <td className="px-5 py-3 text-right font-mono">{c.impressions.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-mono">{c.clicks.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-mono">{c.ctr ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-mono">{c.cpcGBP ? `£${c.cpcGBP}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Social ───────────────────────────────────────────────────────────────

type SocialData = {
  platforms: {
    platform: string;
    latest: {
      stat_date: string; followers: number | null; follower_delta: number | null;
      reach: number | null; impressions: number | null; views: number | null;
      likes: number | null; comments: number | null; shares: number | null;
      saves: number | null; engagement_rate: number | null;
      website_clicks: number | null; attributed_waitlist: number | null;
    } | null;
    history: unknown[];
  }[];
  posts: Record<string, unknown>[];
  hasSyncedData: boolean;
};

const PLATFORM_META: Record<string, { label: string; icon: string; color: string }> = {
  instagram: { label: 'Instagram', icon: '📸', color: 'violet' },
  facebook:  { label: 'Facebook',  icon: '👤', color: 'slate' },
  tiktok:    { label: 'TikTok',    icon: '🎵', color: 'slate' },
  linkedin:  { label: 'LinkedIn',  icon: '💼', color: 'slate' },
  youtube:   { label: 'YouTube',   icon: '▶️',  color: 'slate' },
  x:         { label: 'X / Twitter', icon: '𝕏', color: 'slate' },
};

function SocialTab({ active }: { active: boolean }) {
  const { data, loading, error } = useSection<SocialData>('social', active);

  if (loading) return <Spinner />;
  if (error)   return <SectionError msg={error} />;
  if (!data)   return null;

  return (
    <div className="space-y-8">
      {!data.hasSyncedData && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 text-sm text-slate-400">
          No social data yet. Social stats are entered manually via the Supabase Table Editor or via platform API integrations when configured. Supported platforms: Instagram, Facebook, TikTok, LinkedIn, YouTube, X.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.platforms.map(p => {
          const meta = PLATFORM_META[p.platform] ?? { label: p.platform, icon: '📊', color: 'slate' };
          const s    = p.latest;
          return (
            <div key={p.platform} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 ${!s ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">{meta.label}</span>
                </div>
                {s
                  ? <span className="text-[9px] font-mono text-slate-400">{s.stat_date}</span>
                  : <Badge label="No data" color="slate" />}
              </div>
              {s ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Followers', value: s.followers?.toLocaleString() ?? '—', delta: s.follower_delta },
                    { label: 'Reach',     value: s.reach?.toLocaleString()     ?? '—' },
                    { label: 'Views',     value: s.views?.toLocaleString()     ?? '—' },
                    { label: 'Eng. Rate', value: s.engagement_rate != null ? `${s.engagement_rate}%` : '—' },
                    { label: 'Likes',     value: s.likes?.toLocaleString()     ?? '—' },
                    { label: 'Shares',    value: s.shares?.toLocaleString()    ?? '—' },
                    { label: 'Comments',  value: s.comments?.toLocaleString()  ?? '—' },
                    { label: 'Saves',     value: s.saves?.toLocaleString()     ?? '—' },
                  ].map(({ label, value, delta }) => (
                    <div key={label}>
                      <p className="text-[9px] font-mono uppercase text-slate-400">{label}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {value}
                        {delta != null && delta !== 0 && (
                          <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No data synced for this platform</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Engagement by platform — grouped bar */}
      {data.hasSyncedData && (() => {
        const engagementData = data.platforms
          .filter(p => p.latest)
          .map(p => ({
            platform: PLATFORM_META[p.platform]?.label ?? p.platform,
            Likes:    p.latest!.likes    ?? 0,
            Comments: p.latest!.comments ?? 0,
            Shares:   p.latest!.shares   ?? 0,
            Saves:    p.latest!.saves    ?? 0,
          }));
        if (engagementData.length === 0) return null;
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Engagement by platform</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={engagementData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.07} />
                <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(v) => [typeof v === 'number' ? v.toLocaleString() : v]}
                  contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="Likes"    fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Comments" fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Shares"   fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Saves"    fill="#8b5cf6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap items-center gap-5 text-[11px]">
              {[['#10b981','Likes'],['#6366f1','Comments'],['#f59e0b','Shares'],['#8b5cf6','Saves']].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />{l}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Top posts by views — horizontal bar */}
      {data.posts.length > 0 && (() => {
        const postsWithViews = data.posts
          .filter(p => typeof p.views === 'number' && (p.views as number) > 0)
          .sort((a, b) => (b.views as number) - (a.views as number))
          .slice(0, 8)
          .map((p, i) => ({
            label: (p.hook && String(p.hook).length > 0)
              ? String(p.hook).slice(0, 32) + (String(p.hook).length > 32 ? '…' : '')
              : `Post ${i + 1}`,
            views:   (p.views as number) ?? 0,
            likes:   (p.likes as number) ?? 0,
            platform: String(p.platform ?? ''),
          }));
        if (postsWithViews.length === 0) return null;
        return (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top posts by views</h3>
            <ResponsiveContainer width="100%" height={Math.max(160, postsWithViews.length * 36)}>
              <BarChart
                layout="vertical"
                data={postsWithViews}
                margin={{ top: 0, right: 60, left: 140, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.07} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={136} />
                <Tooltip
                  formatter={(v, name) => [typeof v === 'number' ? v.toLocaleString() : v, name === 'views' ? 'Views' : 'Likes']}
                  contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="views" fill="#10b981" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="likes" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Views</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Likes</span>
            </div>
          </div>
        );
      })()}

      {/* Posts table */}
      {data.posts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Content performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-mono uppercase text-slate-400">
                  <th className="px-4 py-2 text-left">Platform</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Hook</th>
                  <th className="px-4 py-2 text-left">Creator</th>
                  <th className="px-4 py-2 text-right">Views</th>
                  <th className="px-4 py-2 text-right">Likes</th>
                  <th className="px-4 py-2 text-right">Shares</th>
                  <th className="px-4 py-2 text-right">Waitlist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.posts.map((p: Record<string, unknown>, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2 capitalize">{String(p.platform ?? '—')}</td>
                    <td className="px-4 py-2">{String(p.content_type ?? '—')}</td>
                    <td className="px-4 py-2 max-w-[160px] truncate">{String(p.hook ?? '—')}</td>
                    <td className="px-4 py-2">{String(p.creator_type ?? '—')}</td>
                    <td className="px-4 py-2 text-right">{p.views != null ? String(p.views) : '—'}</td>
                    <td className="px-4 py-2 text-right">{p.likes != null ? String(p.likes) : '—'}</td>
                    <td className="px-4 py-2 text-right">{p.shares != null ? String(p.shares) : '—'}</td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400">{p.attributed_waitlist != null ? String(p.attributed_waitlist) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Recommendations ──────────────────────────────────────────────────────

type Rec = {
  id: string; section: string; finding: string; evidence: string;
  recommended_action: string; confidence: 'high' | 'medium' | 'low';
  risk: string; expected_impact: string; status: string; generated_at: string;
};

type RecsData = { recommendations: Rec[]; actions: unknown[] };

const CONFIDENCE_STYLE: Record<string, string> = {
  high:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10  text-amber-600  dark:text-amber-400  border-amber-500/20',
  low:    'bg-slate-500/10  text-slate-500  border-slate-500/20',
};

function RecommendationsTab({ active }: { active: boolean }) {
  const [data, setData]     = useState<RecsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/marketing/recommendations');
      const json = await res.json() as RecsData;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && !data && !loading) fetchData();
  }, [active, data, loading, fetchData]);

  const generate = async () => {
    setGenerating(true);
    await fetch('/api/admin/marketing/recommendations', { method: 'POST', body: JSON.stringify({ action: 'generate' }), headers: { 'Content-Type': 'application/json' } });
    await fetchData();
    setGenerating(false);
  };

  const act = async (id: string, action: 'approve' | 'reject' | 'dismiss') => {
    setActionLoading(id);
    await fetch('/api/admin/marketing/recommendations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, id }),
    });
    await fetchData();
    setActionLoading(null);
  };

  if (loading) return <Spinner />;
  if (!data)   return null;

  const pending  = data.recommendations.filter(r => r.status === 'pending');
  const approved = data.recommendations.filter(r => r.status === 'approved');
  const rejected = data.recommendations.filter(r => r.status === 'rejected');

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI Recommendations</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Workflow: Analyse → Recommend → <strong>Approve</strong> → Execute. AI never changes ads automatically.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-colors"
        >
          {generating ? <><div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Analysing…</> : '⚡ Generate recommendations'}
        </button>
      </div>

      {/* Approval-first notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">⚠ Approval-first policy</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          AI may never automatically change ad spend, campaign status, targeting, bids, or creatives.
          Approving a recommendation logs it in the audit trail and marks it for manual execution.
          All approved actions are recorded immutably in recommendation_actions.
        </p>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Pending ({pending.length})</h4>
          {pending.map(r => (
            <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge label={r.section.replace('_', ' ')} color="violet" />
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${CONFIDENCE_STYLE[r.confidence]}`}>
                    {r.confidence} confidence
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{new Date(r.generated_at).toLocaleString('en-GB')}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.finding}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{r.evidence}</p>
              </div>
              <div className="border-l-2 border-emerald-500/40 pl-3 space-y-1">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Recommended action</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{r.recommended_action}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Risk</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{r.risk}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Expected impact</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{r.expected_impact}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => act(r.id, 'approve')}
                  disabled={actionLoading === r.id}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors"
                >
                  Approve & log
                </button>
                <button
                  onClick={() => act(r.id, 'reject')}
                  disabled={actionLoading === r.id}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => act(r.id, 'dismiss')}
                  disabled={actionLoading === r.id}
                  className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && (
        <EmptyState msg='No pending recommendations. Click "Generate" to analyse current data.' />
      )}

      {/* Approved (collapsed) */}
      {approved.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500 uppercase tracking-widest list-none flex items-center gap-2">
            <span>Approved ({approved.length})</span>
            <span className="text-slate-300 group-open:rotate-90 transition-transform">▶</span>
          </summary>
          <div className="mt-3 space-y-2">
            {approved.map(r => (
              <div key={r.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{r.finding}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{r.recommended_action}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {rejected.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500 uppercase tracking-widest list-none flex items-center gap-2">
            <span>Rejected ({rejected.length})</span>
            <span className="text-slate-300 group-open:rotate-90 transition-transform">▶</span>
          </summary>
          <div className="mt-3 space-y-2">
            {rejected.map(r => (
              <div key={r.id} className="rounded-xl border border-red-500/10 bg-red-500/5 px-4 py-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">{r.finding}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ── Tab: Tracking Health ──────────────────────────────────────────────────────

type HealthData = {
  events: { event: string; status: string }[];
  utmCoveragePercent: number | null;
  attrCoveragePercent: number | null;
  unattributedUsers: number;
  totalAttributionRows: number;
  linkedAttributionRows: number;
  lastStripeSync: string | null;
  lastAdSync: string | null;
  providers: { provider: string; enabled: boolean; hasPixel: boolean; hasCapiToken: boolean }[];
  totalVisitorSessions: number;
};

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  ok:             { dot: 'bg-emerald-500', label: 'OK' },
  no_data:        { dot: 'bg-slate-400',   label: 'No data' },
  not_synced:     { dot: 'bg-amber-500',   label: 'Not synced' },
  not_configured: { dot: 'bg-amber-500',   label: 'Not configured' },
};

function TrackingHealthTab({ active }: { active: boolean }) {
  const { data, loading, error } = useSection<HealthData>('tracking_health', active);

  if (loading) return <Spinner />;
  if (error)   return <SectionError msg={error} />;
  if (!data)   return null;

  return (
    <div className="space-y-8">
      {/* Event status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Event tracking status</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.events.map(e => {
            const style = STATUS_STYLE[e.status] ?? { dot: 'bg-slate-400', label: e.status };
            return (
              <div key={e.event} className="px-5 py-3 flex items-center justify-between gap-4">
                <span className="text-sm text-slate-700 dark:text-slate-300">{e.event}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className={`text-[11px] font-mono ${e.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {style.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coverage metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat
          label="UTM coverage"
          value={data.utmCoveragePercent != null ? `${data.utmCoveragePercent}%` : '—'}
          sub="visitor sessions with utm_source"
          valueClass={data.utmCoveragePercent != null && data.utmCoveragePercent < 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
        />
        <Stat
          label="Attribution coverage"
          value={data.attrCoveragePercent != null ? `${data.attrCoveragePercent}%` : '—'}
          sub="users with linked attribution row"
        />
        <Stat
          label="Unattributed users"
          value={String(data.unattributedUsers)}
          sub="no first-touch record"
          valueClass={data.unattributedUsers > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}
        />
        <Stat label="Attribution rows" value={String(data.totalAttributionRows)} sub={`${data.linkedAttributionRows} linked to user`} />
      </div>

      {/* Platform providers */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Pixel & CAPI configuration</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.providers.map(p => (
            <div key={p.provider} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
              <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{p.provider}</span>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-mono ${p.enabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {p.enabled ? 'enabled' : 'disabled'}
                </span>
                <span className={`text-[11px] font-mono ${p.hasPixel ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {p.hasPixel ? 'pixel ✓' : 'no pixel'}
                </span>
                <span className={`text-[11px] font-mono ${p.hasCapiToken ? 'text-emerald-500' : 'text-slate-400'}`}>
                  {p.hasCapiToken ? 'CAPI ✓' : 'no CAPI'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync timestamps */}
      <div className="space-y-2 text-xs text-slate-400 font-mono">
        <p>Last Stripe sync: {data.lastStripeSync ? new Date(data.lastStripeSync).toLocaleString('en-GB') : 'Unknown'}</p>
        <p>Last ad platform sync: {data.lastAdSync ? new Date(data.lastAdSync).toLocaleString('en-GB') : 'Not synced'}</p>
        <p>Visitor sessions in window: {data.totalVisitorSessions.toLocaleString()}</p>
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export function MarketingClient() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Marketing Intelligence</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Source of truth: Supabase (users/product) · Stripe (payments) · Ad platforms (spend/engagement)
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <nav className="flex gap-0.5 min-w-max">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
              {t.id === 'recommendations' && <span className="ml-1.5 text-[10px] font-mono text-violet-400">AI</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div>
        {activeTab === 'overview'        && <OverviewTab        active={true} />}
        {activeTab === 'paid_media'      && <PaidMediaTab       active={true} />}
        {activeTab === 'attribution'     && <AttributionTab     active={true} />}
        {activeTab === 'campaigns'       && <CampaignsTab       active={true} />}
        {activeTab === 'creatives'       && <CreativesTab       active={true} />}
        {activeTab === 'social'          && <SocialTab          active={true} />}
        {activeTab === 'recommendations' && <RecommendationsTab active={true} />}
        {activeTab === 'tracking_health' && <TrackingHealthTab  active={true} />}
      </div>
    </div>
  );
}
