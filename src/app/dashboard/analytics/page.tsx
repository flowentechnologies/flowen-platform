'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import MainNavbar from '@/components/MainNavbar';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface TelemetryRow {
  id:               string;
  created_at:       string;
  pitch_smoothness: number | null;
  hesitation_count: number | null;
  latency_ms:       number | null;
}

export default function AnalyticsPage() {
  const [rows,    setRows]    = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error: dbErr } = await supabase
        .from('telemetry_logs')
        .select('id, created_at, pitch_smoothness, hesitation_count, latency_ms')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dbErr) setError(dbErr.message);
      else       setRows(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const avg = (key: keyof TelemetryRow) => {
    const vals = rows.map(r => r[key] as number | null).filter((v): v is number => v !== null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="pb-6 border-b border-slate-800">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            REAL-TIME TELEMETRY
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">Telemetry Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Last 50 sessions — acoustic biofeedback metrics</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Avg Pitch Smoothness', value: avg('pitch_smoothness'), unit: '%', colour: 'emerald' },
            { label: 'Avg Hesitations',       value: avg('hesitation_count'), unit: '/session', colour: 'amber' },
            { label: 'Avg Latency',           value: avg('latency_ms'),       unit: ' ms', colour: 'cyan' },
          ].map(card => (
            <div key={card.label} className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
              <span className={`text-xs font-mono text-${card.colour}-400 uppercase tracking-widest`}>{card.label}</span>
              <p className="text-3xl font-extrabold text-white mt-2">
                {card.value}<span className="text-sm font-normal text-slate-400">{card.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Sessions table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-white">Session History</h2>
          </div>

          {loading && (
            <div className="px-6 py-12 text-center text-slate-500 text-sm">Loading telemetry…</div>
          )}

          {error && (
            <div className="px-6 py-6 text-center text-red-400 text-sm">{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500 text-sm">
              No sessions yet. Complete a practice exercise to see your telemetry here.
            </div>
          )}

          {!loading && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-mono text-slate-500 uppercase tracking-widest">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Pitch Smoothness</th>
                  <th className="px-6 py-3">Hesitations</th>
                  <th className="px-6 py-3">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3 text-slate-400 font-mono text-xs">
                      {new Date(row.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`font-semibold ${(row.pitch_smoothness ?? 0) >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {row.pitch_smoothness != null ? `${row.pitch_smoothness}%` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-300">
                      {row.hesitation_count ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-300">
                      {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
