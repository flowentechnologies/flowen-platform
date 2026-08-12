'use client';

import React, { useState, useCallback, useMemo, useTransition } from 'react';
import type { AuditEntry } from '@/app/api/admin/audit/route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncate(str: string | null, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AuditEntry['severity'] }) {
  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        critical
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
        warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-700/60 text-slate-400 border border-slate-600/40">
      info
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'red';
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-1">
      <span className={`text-2xl font-extrabold ${accent === 'red' ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}>
        {value}
      </span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  initialEntries: AuditEntry[];
  total: number;
}

type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';
type DateRange = 'all' | '24h' | '7d' | '30d';

export function AuditClient({ initialEntries, total: initialTotal }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [actionSearch, setActionSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [isPending, startTransition] = useTransition();

  const LIMIT = 50;

  // ── Client-side filtering of loaded entries ──────────────────────────────
  const filtered = useMemo(() => {
    let list = entries;

    if (severityFilter !== 'all') {
      list = list.filter((e) => e.severity === severityFilter);
    }

    if (actionSearch.trim()) {
      const q = actionSearch.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          (e.actor_email ?? '').toLowerCase().includes(q),
      );
    }

    if (dateRange !== 'all') {
      const ms = dateRange === '24h' ? 86400000 : dateRange === '7d' ? 604800000 : 2592000000;
      const cutoff = Date.now() - ms;
      list = list.filter((e) => new Date(e.created_at).getTime() >= cutoff);
    }

    return list;
  }, [entries, severityFilter, actionSearch, dateRange]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const last24hCount = useMemo(() => {
    const cutoff = Date.now() - 86400000;
    return entries.filter((e) => new Date(e.created_at).getTime() >= cutoff).length;
  }, [entries]);

  const criticalCount = useMemo(
    () => entries.filter((e) => e.severity === 'critical').length,
    [entries],
  );

  // ── Load more ────────────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    startTransition(async () => {
      const nextPage = page + 1;
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(LIMIT),
        severity: severityFilter,
        dateRange,
        search: actionSearch,
      });
      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json() as { entries: AuditEntry[]; total: number };
      setEntries((prev) => [...prev, ...json.entries]);
      setTotal(json.total);
      setPage(nextPage);
    });
  }, [page, severityFilter, dateRange, actionSearch]);

  // ── CSV Export ───────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const headers = ['id', 'created_at', 'severity', 'action', 'resource_type', 'resource_id', 'actor_email', 'ip_address', 'metadata'];
    const rows = filtered.map((e) => [
      e.id,
      e.created_at,
      e.severity,
      e.action,
      e.resource_type ?? '',
      e.resource_id ?? '',
      e.actor_email ?? '',
      e.ip_address ?? '',
      e.metadata ? JSON.stringify(e.metadata) : '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const hasMore = entries.length < total;

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Entries" value={total} />
        <StatCard label="Last 24 Hours" value={last24hCount} />
        <StatCard label="Critical Events" value={criticalCount} accent="red" />
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
        {/* Severity pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'info', 'warning', 'critical'] as SeverityFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                severityFilter === s
                  ? s === 'critical'
                    ? 'bg-red-500/20 text-red-300 border-red-500/50'
                    : s === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : s === 'info'
                    ? 'bg-slate-600/60 text-slate-200 border-slate-500/60'
                    : 'bg-slate-700 text-slate-900 dark:text-white border-slate-600'
                  : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Action search */}
        <input
          type="text"
          placeholder="Search action or actor…"
          value={actionSearch}
          onChange={(e) => setActionSearch(e.target.value)}
          className="flex-1 min-w-[180px] bg-slate-100 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />

        {/* Date range */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { value: '24h', label: 'Last 24h' },
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
            { value: 'all', label: 'All time' },
          ] as { value: DateRange; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                dateRange === opt.value
                  ? 'bg-slate-700 text-slate-900 dark:text-white border-slate-600'
                  : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Export button */}
        <button
          onClick={exportCsv}
          className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <svg className="w-12 h-12 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-400 text-sm">No audit events recorded yet.</p>
            <p className="text-slate-600 text-xs mt-1">Admin actions will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Resource</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">IP</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr
                      className={`text-slate-600 dark:text-slate-300 hover:bg-slate-800/40 transition-colors ${
                        entry.severity === 'critical' ? 'border-l-2 border-red-500/50' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        <span title={absoluteTime(entry.created_at)} className="cursor-default">
                          {relativeTime(entry.created_at)}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={entry.severity} />
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">
                        {entry.action}
                      </td>

                      {/* Resource */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {entry.resource_type ? (
                          <span className="text-slate-400">
                            {entry.resource_type}
                            {entry.resource_id ? (
                              <span className="text-slate-500 font-mono ml-1">
                                #{truncate(entry.resource_id, 12)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                        {truncate(entry.actor_email, 28)}
                      </td>

                      {/* IP */}
                      <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                        {entry.ip_address ?? '—'}
                      </td>

                      {/* Details expand */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {entry.metadata ? (
                          <button
                            onClick={() =>
                              setExpandedId((prev) => (prev === entry.id ? null : entry.id))
                            }
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                            aria-label="Toggle metadata"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${
                                expandedId === entry.id ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            <span className="text-xs">View</span>
                          </button>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded metadata row */}
                    {expandedId === entry.id && entry.metadata && (
                      <tr className="bg-slate-100 dark:bg-slate-950/60">
                        <td colSpan={7} className="px-6 py-4">
                          <pre className="text-xs text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more */}
        {hasMore && filtered.length > 0 && (
          <div className="flex items-center justify-center py-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={loadMore}
              disabled={isPending}
              className="px-6 py-2 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Loading…' : `Load more (${total - entries.length} remaining)`}
            </button>
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 text-right">
            Showing {filtered.length} of {total} entries
          </div>
        )}
      </div>
    </div>
  );
}
