'use client';

import { useState, useEffect, useCallback } from 'react';

interface EntityOverview {
  slug: string;
  name: string;
  tenantName: string | null;
  currency: string | null;
  revenue: number;
  expenses: number;
  net: number;
  totalAssets: number | null;
  totalLiabilities: number | null;
  netAssets: number | null;
  bankTransactionsFetched: number;
  unreconciledCount: number;
  uncodedCount: number;
  activeAccountCount: number;
  pendingDrafts: number;
  error: string | null;
}

interface Overview {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  connectedCount: number;
  totalEntities: number;
  totals: {
    revenue: number; expenses: number; net: number;
    totalAssets: number; totalLiabilities: number; netAssets: number;
    pendingDrafts: number; unreconciledCount: number; uncodedCount: number;
  };
  entities: EntityOverview[];
}

function gbp(n: number): string {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
}

function structureNodeFill(e: EntityOverview | undefined): string {
  return e?.error ? 'fill-amber-50 dark:fill-amber-500/10' : 'fill-emerald-50 dark:fill-emerald-500/10';
}
function structureNodeStroke(e: EntityOverview | undefined): string {
  return e?.error ? 'stroke-amber-300 dark:stroke-amber-600' : 'stroke-emerald-300 dark:stroke-emerald-600';
}
function structureDotFill(e: EntityOverview | undefined): string {
  return e?.error ? 'fill-amber-500' : 'fill-emerald-500';
}

function StructureNode({ e, label, x, y, w, h, role }: { e: EntityOverview | undefined; label: string; x: number; y: number; w: number; h: number; role: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} className={`${structureNodeFill(e)} ${structureNodeStroke(e)}`} strokeWidth={1.5} />
      <circle cx={x + 13} cy={y + 19} r={4} className={structureDotFill(e)} />
      <text x={x + 22} y={y + 23} className="fill-slate-900 dark:fill-white text-[11px] font-semibold">{label}</text>
      <text x={x + 13} y={y + 39} className="fill-slate-500 dark:fill-slate-400 text-[9px]">{role}</text>
      <text x={x + 13} y={y + h - 11} className={`text-[10px] font-bold tabular-nums ${!e?.error && (e?.net ?? 0) >= 0 ? 'fill-emerald-600 dark:fill-emerald-400' : e?.error ? 'fill-amber-600 dark:fill-amber-400' : 'fill-red-600 dark:fill-red-400'}`}>
        {e?.error ? 'Not connected' : `${gbp(e?.net ?? 0)} net`}
      </text>
    </g>
  );
}

// The group's actual legal/functional structure — Group is a pure
// non-trading holding company; IP holds and licenses the IP; Speech
// Technologies is the trading subsidiary that runs the live product; Labs
// does R&D. This isn't cosmetic: which entity should carry a given expense
// or transaction follows directly from this shape (see reconcile-dla),
// and it's the same shape the SEIS/EIS qualifying-holding-company test
// cares about — Group showing real trading activity here would be a red
// flag, not just an odd-looking number.
function GroupStructureDiagram({ entities }: { entities: EntityOverview[] }) {
  const by = (slug: string) => entities.find(e => e.slug === slug);
  const group = by('group');
  const ip = by('ip');
  const speech = by('speech-technologies');
  const labs = by('labs');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Group Structure</p>
      <svg viewBox="0 0 720 260" className="w-full h-auto" role="img" aria-label="Flowen group structure: Flowen Group Ltd owns Flowen IP Ltd, Flowen Speech Technologies Ltd, and Flowen Labs Ltd; IP licenses to Speech Technologies.">
        {/* Ownership lines: Group -> each subsidiary */}
        <line x1={360} y1={78} x2={120} y2={158} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth={1.5} />
        <line x1={360} y1={78} x2={360} y2={158} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth={1.5} />
        <line x1={360} y1={78} x2={600} y2={158} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth={1.5} />
        <text x={195} y={122} className="fill-slate-400 text-[9px] chrome">100% owned</text>
        <text x={362} y={122} className="fill-slate-400 text-[9px] chrome">100% owned</text>
        <text x={495} y={122} className="fill-slate-400 text-[9px] chrome">100% owned</text>

        {/* IP licenses to Speech Technologies */}
        <line x1={210} y1={195} x2={255} y2={195} strokeDasharray="4 3" className="stroke-cyan-400 dark:stroke-cyan-600" strokeWidth={1.5} />
        <text x={195} y={188} className="fill-cyan-600 dark:fill-cyan-400 text-[9px]">licenses IP →</text>

        <StructureNode e={group} label="Flowen Group" x={260} y={18} w={200} h={60} role="Non-trading holding company" />
        <StructureNode e={ip} label="Flowen IP" x={20} y={158} w={190} h={72} role="Holds & licenses IP" />
        <StructureNode e={speech} label="Speech Technologies" x={255} y={158} w={210} h={72} role="Trading subsidiary" />
        <StructureNode e={labs} label="Flowen Labs" x={505} y={158} w={190} h={72} role="R&D" />
      </svg>
      <p className="text-[11px] text-slate-400 mt-2">
        Group holds no trade of its own — any real revenue or expense showing here would be worth a second look against
        the SEIS/EIS qualifying-holding-company test.
      </p>
    </div>
  );
}

export function OverviewClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/bookkeeping/overview')
      .then(r => r.json())
      .then((d: Overview | { error: string }) => {
        if ('error' in d) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('Failed to reach the server'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Group Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consolidated snapshot across every connected Flowen entity — a rollup, not a true consolidation.
            {data && ` P&L: ${new Date(data.periodStart).toLocaleDateString('en-GB')} – ${new Date(data.periodEnd).toLocaleDateString('en-GB')} (tax year to date). Balance Sheet: as at ${new Date(data.periodEnd).toLocaleDateString('en-GB')}.`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : data ? (
        <>
          <GroupStructureDiagram entities={data.entities} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Revenue</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{gbp(data.totals.revenue)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Expenses</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{gbp(data.totals.expenses)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Net</p>
              <p className={`text-2xl font-bold mt-1 tabular-nums ${data.totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {gbp(data.totals.net)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pending drafts</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{data.totals.pendingDrafts}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total assets</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{gbp(data.totals.totalAssets)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total liabilities</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">{gbp(data.totals.totalLiabilities)}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Net assets</p>
              <p className={`text-xl font-bold mt-1 tabular-nums ${data.totals.netAssets >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {gbp(data.totals.netAssets)}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
            Revenue, expenses, and Balance Sheet figures come from Xero&apos;s real Profit &amp; Loss and Balance Sheet reports for
            each entity — not an approximation. What&apos;s still not true consolidation: intercompany transactions between
            entities aren&apos;t eliminated (e.g. Group funding a subsidiary shows as an expense in one and income in another), so
            treat the group-wide totals as a directional rollup, not a statutory consolidated position.
            {' '}{data.connectedCount}/{data.totalEntities} entities connected.
          </div>

          <div className="space-y-3">
            {data.entities.map(e => (
              <div key={e.slug} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {e.error ? e.error : e.tenantName ? `Connected to ${e.tenantName}` : '—'}
                    </p>
                  </div>
                  {!e.error && (
                    <span className={`flex-shrink-0 text-sm font-bold tabular-nums ${e.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {gbp(e.net)} net
                    </span>
                  )}
                </div>
                {!e.error && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <p className="text-slate-400">Revenue</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{gbp(e.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Expenses</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{gbp(e.expenses)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Net assets</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{e.netAssets !== null ? gbp(e.netAssets) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Unreconciled txns</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{e.unreconciledCount} / {e.bankTransactionsFetched}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Uncoded txns</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{e.uncodedCount} / {e.bankTransactionsFetched}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Chart of accounts</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{e.activeAccountCount} active</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Pending drafts</p>
                      <p className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">{e.pendingDrafts}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">Generated {new Date(data.generatedAt).toLocaleString('en-GB')}</p>
        </>
      ) : null}
    </div>
  );
}
