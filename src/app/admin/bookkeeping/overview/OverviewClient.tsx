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
  invoicesConsidered: number;
  bankTransactionsFetched: number;
  unreconciledCount: number;
  uncodedCount: number;
  activeAccountCount: number;
  pendingDrafts: number;
  error: string | null;
}

interface Overview {
  generatedAt: string;
  connectedCount: number;
  totalEntities: number;
  totals: { revenue: number; expenses: number; net: number; pendingDrafts: number; unreconciledCount: number; uncodedCount: number };
  entities: EntityOverview[];
}

function gbp(n: number): string {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
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

          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
            Revenue/expenses are computed from each entity&apos;s most recent invoices (not a full accrual P&amp;L — Xero&apos;s
            report API isn&apos;t connected), and intercompany transactions between entities aren&apos;t eliminated. Treat this
            as a directional rollup, not a statutory consolidation. {data.connectedCount}/{data.totalEntities} entities connected.
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
