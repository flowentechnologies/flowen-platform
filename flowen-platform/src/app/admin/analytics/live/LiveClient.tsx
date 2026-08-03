'use client';

import { useEffect, useState, useCallback } from 'react';

interface AnalyticsData {
  live_visitors:       number;
  today_visitors:      number;
  today_page_views:    number;
  today_conversions:   number;
  conversion_rate_pct: number;
  top_countries:       { country: string; count: number }[];
  top_channels:        { channel: string; count: number }[];
  top_pages:           { path: string; views: number }[];
  daily_series:        { date: string; visitors: number }[];
  as_of:               string;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, max, color = 'bg-emerald-500' }: { label: string; count: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-slate-300 w-40 truncate shrink-0">{label}</span>
      <div className="flex-1 bg-slate-800 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-slate-400 w-10 text-right shrink-0">{count}</span>
    </div>
  );
}

const COUNTRY_FLAGS: Record<string, string> = {
  GB: '🇬🇧', US: '🇺🇸', CA: '🇨🇦', AU: '🇦🇺', IE: '🇮🇪',
  DE: '🇩🇪', FR: '🇫🇷', IN: '🇮🇳', NL: '🇳🇱', SE: '🇸🇪',
};

export default function LiveClient() {
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/live');
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-5 h-24" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-red-400 text-sm">Failed to load analytics: {error}</p>;
  }

  if (!data) return null;

  const maxCountry = data.top_countries[0]?.count ?? 1;
  const maxChannel = data.top_channels[0]?.count ?? 1;
  const maxPage    = data.top_pages[0]?.views ?? 1;
  const maxDay     = Math.max(...data.daily_series.map(d => d.visitors), 1);

  const asOf = new Date(data.as_of).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#0A0D14] border border-emerald-500/30 rounded-2xl p-5 col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Live now</p>
          <p className="text-4xl font-bold text-emerald-400">{data.live_visitors}</p>
          <p className="text-xs text-slate-500 mt-1">active in last 5 min</p>
        </div>
        <StatCard label="Visitors today"    value={data.today_visitors.toLocaleString()} />
        <StatCard label="Page views today"  value={data.today_page_views.toLocaleString()} />
        <StatCard label="Conversions today" value={data.today_conversions.toLocaleString()} />
        <StatCard
          label="Conv. rate today"
          value={`${data.conversion_rate_pct}%`}
          sub="signups / sessions"
        />
      </div>

      {/* 30-day sparkline */}
      {data.daily_series.length > 0 && (
        <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Daily visitors — last 30 days</p>
          <div className="flex items-end gap-0.5 h-24">
            {data.daily_series.map(({ date, visitors }) => (
              <div key={date} className="flex-1 flex flex-col items-center group relative">
                <div
                  className="w-full bg-emerald-500/60 hover:bg-emerald-400 rounded-sm transition-colors"
                  style={{ height: `${Math.max(2, Math.round((visitors / maxDay) * 96))}px` }}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center pointer-events-none">
                  <div className="bg-slate-700 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap">
                    {date}: {visitors}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channels */}
        <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Traffic channels · 30 days</p>
          {data.top_channels.length === 0
            ? <p className="text-slate-600 text-sm">No data yet</p>
            : data.top_channels.map(({ channel, count }) => (
              <BarRow key={channel} label={channel} count={count} max={maxChannel} color="bg-violet-500" />
            ))
          }
        </div>

        {/* Countries */}
        <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Top countries · 30 days</p>
          {data.top_countries.length === 0
            ? <p className="text-slate-600 text-sm">No data yet</p>
            : data.top_countries.map(({ country, count }) => (
              <BarRow
                key={country}
                label={`${COUNTRY_FLAGS[country] ?? '🌍'} ${country}`}
                count={count}
                max={maxCountry}
                color="bg-sky-500"
              />
            ))
          }
        </div>

        {/* Top pages today */}
        <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Top pages today</p>
          {data.top_pages.length === 0
            ? <p className="text-slate-600 text-sm">No data yet</p>
            : data.top_pages.map(({ path, views }) => (
              <BarRow key={path} label={path} count={views} max={maxPage} color="bg-amber-500" />
            ))
          }
        </div>
      </div>

      <p className="text-xs text-slate-600 text-right">Updated {asOf} · auto-refreshes every 30s</p>
    </div>
  );
}
