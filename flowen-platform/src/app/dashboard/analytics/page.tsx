import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { formatTotalTime } from '@/lib/format';
import { PROGRAMME } from '@/lib/programme';
import { BpmTrendChart, type TrendPoint } from './BpmTrendChart';
import { WeeklyChart, type WeekBar } from './WeeklyChart';
import { CalendarHeatmap, type CalDay } from './CalendarHeatmap';
import { DisfluencyBreakdownChart, type BreakdownPoint } from './DisfluencyBreakdownChart';

export const metadata: Metadata = {
  title: 'Progress | Flowen',
  robots: { index: false, follow: false },
};

function db() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function isoMonday(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const admin = db();

  const [sessionsRes, progRes, hasPlanRes] = await Promise.all([
    admin
      .from('practice_sessions')
      .select('id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    admin
      .from('user_programme')
      .select('current_week')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('treatment_plans')
      .select('sessions_per_week')
      .eq('patient_user_id', user.id)
      .eq('active', true)
      .maybeSingle(),
  ]);

  const sessions = sessionsRes.data ?? [];
  const n = sessions.length;

  // Target sessions/week from plan or programme
  const targetSessions: number | undefined = (() => {
    if (hasPlanRes.data) return hasPlanRes.data.sessions_per_week;
    const week = progRes.data?.current_week;
    if (week) return PROGRAMME[Math.min(week, PROGRAMME.length) - 1].targetSessions;
    return undefined;
  })();

  // ── BPM trend points ──────────────────────────────────────────────────────

  const trendPoints: TrendPoint[] = sessions.map((s, i) => ({
    sessionNum: i + 1,
    bpm: s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0,
    date: s.created_at.slice(0, 10),
  }));

  const breakdownPoints: BreakdownPoint[] = sessions.map((s, i) => ({
    sessionNum: i + 1,
    date: s.created_at.slice(0, 10),
    blocks:        s.total_blocks_detected        ?? 0,
    prolongations: s.total_prolongations_detected ?? 0,
    repetitions:   s.total_repetitions_detected   ?? 0,
  }));

  // ── Disfluency lifetime totals ────────────────────────────────────────────

  const lifetimeTotals = sessions.reduce(
    (acc, s) => ({
      blocks:        acc.blocks        + (s.total_blocks_detected        ?? 0),
      prolongations: acc.prolongations + (s.total_prolongations_detected ?? 0),
      repetitions:   acc.repetitions   + (s.total_repetitions_detected   ?? 0),
    }),
    { blocks: 0, prolongations: 0, repetitions: 0 },
  );

  const hasDisfluencyData = breakdownPoints.some(
    p => p.blocks > 0 || p.prolongations > 0 || p.repetitions > 0,
  );

  // ── KPI summary ───────────────────────────────────────────────────────────

  const totalSeconds = sessions.reduce((s, r) => s + r.duration_seconds, 0);

  const qualifiedSessions = sessions.filter(s => s.duration_seconds >= 90);
  const bestBpm = qualifiedSessions.length > 0
    ? Math.min(...qualifiedSessions.map(s => s.total_blocks_detected / (s.duration_seconds / 60)))
    : null;

  let trend: { pct: number; direction: 'improving' | 'stable' | 'regressing' } | null = null;
  if (trendPoints.length >= 6) {
    const first3 = trendPoints.slice(0, 3).reduce((s, p) => s + p.bpm, 0) / 3;
    const last3 = trendPoints.slice(-3).reduce((s, p) => s + p.bpm, 0) / 3;
    if (first3 > 0) {
      const pct = Math.round(Math.abs((last3 - first3) / first3) * 100);
      trend = {
        pct,
        direction: last3 < first3 - 0.1 ? 'improving' : last3 > first3 + 0.1 ? 'regressing' : 'stable',
      };
    }
  }

  // ── Weekly bars (last 12 weeks) ───────────────────────────────────────────

  const today = new Date();
  const thisMonday = isoMonday(today);

  // Build map: weekKey (ISO Monday) → { sessions, totalBpm }
  const weekMap = new Map<string, { sessions: number; totalBpm: number }>();
  for (const s of sessions) {
    const d = new Date(s.created_at);
    const mon = isoMonday(d);
    const key = mon.toISOString().slice(0, 10);
    const bpm = s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
    const entry = weekMap.get(key) ?? { sessions: 0, totalBpm: 0 };
    entry.sessions++;
    entry.totalBpm += bpm;
    weekMap.set(key, entry);
  }

  const weekBars: WeekBar[] = Array.from({ length: 12 }, (_, i) => {
    const mon = new Date(thisMonday);
    mon.setDate(thisMonday.getDate() - (11 - i) * 7);
    const key = mon.toISOString().slice(0, 10);
    const entry = weekMap.get(key);
    const isCurrentWeek = key === thisMonday.toISOString().slice(0, 10);
    return {
      label: mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      sessions: entry?.sessions ?? 0,
      avgBpm: entry ? entry.totalBpm / entry.sessions : null,
      isCurrentWeek,
    };
  });

  // ── Calendar heatmap (12 weeks = 84 days, starting on a Monday) ───────────

  const calStart = new Date(thisMonday);
  calStart.setDate(thisMonday.getDate() - 11 * 7);

  const dayMap = new Map<string, number>();
  for (const s of sessions) {
    const key = s.created_at.slice(0, 10);
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }

  // 84 days ordered: [col0/Mon, col0/Tue, ..., col0/Sun, col1/Mon, ...]
  const calDays: CalDay[] = Array.from({ length: 84 }, (_, i) => {
    const col = Math.floor(i / 7);
    const row = i % 7;
    const d = new Date(calStart);
    d.setDate(calStart.getDate() + col * 7 + row);
    const date = d.toISOString().slice(0, 10);
    return { date, count: dayMap.get(date) ?? 0 };
  });

  // ── Insights ──────────────────────────────────────────────────────────────

  const daysActiveLast14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().slice(0, 10);
  }).filter(k => (dayMap.get(k) ?? 0) > 0).length;

  // ── Empty state ───────────────────────────────────────────────────────────

  if (n === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progress</h1>
          <p className="text-slate-400 text-sm mt-1">Your improvement over time.</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <p className="text-slate-900 dark:text-white font-semibold text-lg">No sessions yet.</p>
          <p className="text-slate-400 text-sm">Complete a practice session to see your progress charts here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Progress</h1>
          <p className="text-slate-400 text-sm mt-1">
            {n} session{n !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <a
          href="/api/reports/my-progress"
          download
          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v7.44l2.47-2.47a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0L5.72 9.78a.75.75 0 111.06-1.06l2.47 2.47V3.75A.75.75 0 0110 3zm-6.25 13.5a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H3.75z" clipRule="evenodd" />
          </svg>
          Download PDF report
        </a>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total sessions',
            value: String(n),
            sub: 'lifetime',
            color: '',
          },
          {
            label: 'Practice time',
            value: formatTotalTime(totalSeconds),
            sub: 'total',
            color: '',
          },
          {
            label: 'Best session',
            value: bestBpm !== null ? bestBpm.toFixed(1) : '—',
            sub: 'lowest bpm (≥90s)',
            color: bestBpm !== null && bestBpm < 2 ? 'text-emerald-400' : '',
          },
          {
            label: 'Trend',
            value: trend
              ? `${trend.pct}%`
              : n < 6 ? `${n}/6` : '—',
            sub: trend
              ? trend.direction === 'improving' ? 'improvement' : trend.direction === 'regressing' ? 'regression' : 'stable'
              : 'sessions to trend',
            color: trend
              ? trend.direction === 'improving' ? 'text-emerald-400' : trend.direction === 'regressing' ? 'text-red-400' : 'text-slate-400'
              : 'text-slate-600',
          },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">{card.label}</span>
            <span className={`text-3xl font-bold leading-none ${card.color || 'text-slate-900 dark:text-white'}`}>{card.value}</span>
            <span className="text-slate-400 text-xs">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* BPM trend chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Blocks per minute</p>
          <p className="text-slate-900 dark:text-white font-semibold text-sm mt-0.5">Fluency over time</p>
        </div>
        {trendPoints.length < 2 ? (
          <p className="text-slate-500 text-xs py-8 text-center">Complete at least 2 sessions to see the trend.</p>
        ) : (
          <BpmTrendChart points={trendPoints} />
        )}
        <div className="flex items-center gap-6 pt-1">
          {[
            { color: 'bg-emerald-500', label: '< 2 bpm — excellent' },
            { color: 'bg-amber-500', label: '2–5 bpm — moderate' },
            { color: 'bg-red-500', label: '> 5 bpm — high' },
          ].map(z => (
            <div key={z.label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${z.color}`} />
              <span className="text-[10px] text-slate-500 font-mono">{z.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disfluency breakdown */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Disfluency events</p>
            <p className="text-slate-900 dark:text-white font-semibold text-sm mt-0.5">Breakdown per session</p>
          </div>
          {/* Lifetime totals */}
          <div className="flex items-center gap-5">
            {[
              { label: 'Blocks',        value: lifetimeTotals.blocks,        color: 'text-rose-400',   dot: 'bg-rose-500' },
              { label: 'Prolongations', value: lifetimeTotals.prolongations, color: 'text-violet-400', dot: 'bg-violet-500' },
              { label: 'Repetitions',   value: lifetimeTotals.repetitions,   color: 'text-amber-400',  dot: 'bg-amber-500' },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                  <span className="text-[10px] font-mono text-slate-500">{item.label}</span>
                </div>
                <span className={`text-xl font-bold font-mono tabular-nums ${item.color}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {hasDisfluencyData ? (
          <>
            <DisfluencyBreakdownChart points={breakdownPoints} />
            <p className="text-[10px] font-mono text-slate-600">
              Detected by the on-device rule engine · lower is better · PROLONG requires 8+ voiced segments to calibrate
            </p>
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-xs">
              No disfluency events recorded yet — events accumulate from session {n + 1} onwards.
            </p>
            <p className="text-slate-600 text-[10px] font-mono mt-1">
              If you practised before the detector was enabled, those sessions will show 0.
            </p>
          </div>
        )}
      </div>

      {/* Weekly chart + Calendar side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Weekly sessions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Last 12 weeks</p>
            <p className="text-slate-900 dark:text-white font-semibold text-sm mt-0.5">Practice consistency</p>
          </div>
          <WeeklyChart weeks={weekBars} targetSessions={targetSessions} />
          <div className="flex items-center gap-4 pt-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-indigo-400 opacity-70" style={{ borderTop: '1px dashed #818cf8' }} />
              <span className="text-[10px] text-slate-500 font-mono">target</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 bg-indigo-400 rounded" />
              <span className="text-[10px] text-slate-500 font-mono">current week</span>
            </div>
          </div>
        </div>

        {/* Calendar heatmap */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600">Activity</p>
            <p className="text-slate-900 dark:text-white font-semibold text-sm mt-0.5">Practice calendar</p>
          </div>
          <CalendarHeatmap days={calDays} />
          <p className="text-[10px] text-slate-600 font-mono pt-1">
            {daysActiveLast14} of 14 days active in the last 2 weeks
          </p>
        </div>
      </div>

      {/* Zone reference */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">Fluency zones</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { zone: 'Excellent', range: '0–2 bpm', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', desc: 'Fluent speech, techniques well-integrated.' },
            { zone: 'Moderate', range: '2–5 bpm', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5', desc: 'Active monitoring needed, keep practising.' },
            { zone: 'High', range: '> 5 bpm', color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5', desc: 'Focus on slowing rate and technique application.' },
          ].map(z => (
            <div key={z.zone} className={`rounded-xl border ${z.border} ${z.bg} p-3 space-y-1`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${z.color}`}>{z.zone}</span>
                <span className={`text-[10px] font-mono ${z.color} opacity-70`}>{z.range}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{z.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
