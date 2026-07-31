'use client';

import Link from 'next/link';

type Trend = 'improving' | 'plateauing' | 'regressing' | 'no_data';

type RecentSession = {
  id: string;
  created_at: string;
  duration_seconds: number;
  total_blocks_detected: number;
  bpm: number;
};

interface DashboardClientProps {
  displayName: string;
  tier: string | null;
  sessionCount: number;
  totalMins: number;
  streak: number;
  trend: Trend;
  improvementPct: number | null;
  sessionsByDay: Record<string, number>;
  recentBpms: number[];
  recentSessions: RecentSession[];
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function bpmColor(bpm: number): string {
  if (bpm < 2) return 'text-emerald-400';
  if (bpm <= 5) return 'text-amber-400';
  return 'text-red-400';
}

// Builds an array of the last 30 calendar days, oldest first
function buildLast30Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function KpiCard({
  label,
  value,
  sub,
  valueClass = 'text-white',
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
        {label}
      </span>
      <span className={`text-3xl font-bold leading-none ${valueClass}`}>
        {value}
      </span>
      <span className="text-slate-400 text-xs">{sub}</span>
    </div>
  );
}

export function DashboardClient({
  displayName,
  tier,
  sessionCount,
  totalMins,
  streak,
  trend,
  improvementPct,
  sessionsByDay,
  recentBpms,
  recentSessions,
}: DashboardClientProps) {
  const days30 = buildLast30Days();
  const todayKey = new Date().toISOString().slice(0, 10);
  const totalActivitySessions = Object.values(sessionsByDay).reduce(
    (a, b) => a + b,
    0
  );

  // Trend KPI
  let trendValue = '—';
  let trendSub = 'need 3+ sessions';
  let trendClass = 'text-slate-500';
  if (trend === 'improving' && improvementPct !== null) {
    trendValue = `down ${Math.abs(improvementPct)}%`;
    trendSub = 'fewer blocks/min';
    trendClass = 'text-emerald-400';
  } else if (trend === 'regressing' && improvementPct !== null) {
    trendValue = `up ${improvementPct}%`;
    trendSub = 'blocks increasing';
    trendClass = 'text-red-400';
  } else if (trend === 'plateauing') {
    trendValue = 'stable';
    trendSub = 'holding steady';
    trendClass = 'text-amber-400';
  }

  // Bar chart max for activity
  const activityMax = Math.max(1, ...Object.values(sessionsByDay));

  // Bar chart max for bpm
  const bpmMax = Math.max(1, ...recentBpms);

  // Bar color for bpm trend
  function bpmBarColor(i: number): string {
    if (trend === 'improving') return 'bg-emerald-500';
    if (trend === 'regressing') return 'bg-red-500';
    return 'bg-slate-600';
  }

  const latestBpm =
    recentBpms.length > 0 ? recentBpms[recentBpms.length - 1] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* A. Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {greeting()}, {displayName}.
          </h1>
          {tier && (
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              {tier}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/practice"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-colors shrink-0"
        >
          Start Practice
          <span aria-hidden>&#8594;</span>
        </Link>
      </div>

      {/* B. KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Sessions"
          value={String(sessionCount)}
          sub={sessionCount === 1 ? '1 total' : 'lifetime total'}
        />
        <KpiCard
          label="Practice time"
          value={`${totalMins}m`}
          sub="total time"
        />
        <KpiCard
          label="Streak"
          value={`${streak} day${streak !== 1 ? 's' : ''}`}
          sub={streak > 0 ? 'keep it up' : 'start today'}
          valueClass={streak > 0 ? 'text-emerald-400' : 'text-slate-500'}
        />
        <KpiCard
          label="Fluency trend"
          value={trendValue}
          sub={trendSub}
          valueClass={trendClass}
        />
      </div>

      {/* C. Empty state */}
      {sessionCount === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <p className="text-white font-semibold text-lg">No sessions yet.</p>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Start your first practice session to begin tracking your progress.
          </p>
          <Link
            href="/dashboard/practice"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-colors"
          >
            Start practice
            <span aria-hidden>&#8594;</span>
          </Link>
        </div>
      )}

      {sessionCount > 0 && (
        <>
          {/* D. Activity chart — last 30 days */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">
                Practice activity
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                {totalActivitySessions} session
                {totalActivitySessions !== 1 ? 's' : ''} &middot; last 30 days
              </span>
            </div>

            {/* Bars */}
            <div className="flex items-end gap-[3px] h-16">
              {days30.map((day) => {
                const count = sessionsByDay[day] ?? 0;
                const heightPct =
                  count > 0 ? Math.max(12, (count / activityMax) * 100) : 0;
                const isToday = day === todayKey;
                return (
                  <div
                    key={day}
                    className="flex-1 flex flex-col justify-end"
                    title={`${day}: ${count} session${count !== 1 ? 's' : ''}`}
                  >
                    <div
                      style={{ height: count > 0 ? `${heightPct}%` : '2px' }}
                      className={`rounded-sm transition-all ${
                        count === 0
                          ? 'bg-slate-800'
                          : isToday
                          ? 'bg-emerald-400'
                          : 'bg-slate-600'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Day labels: Mon/Wed/Fri roughly */}
            <div className="flex items-center gap-[3px]">
              {days30.map((day, i) => {
                const d = new Date(day);
                const dow = d.getUTCDay(); // 0=Sun, 1=Mon, 3=Wed, 5=Fri
                const show = dow === 1 || dow === 3 || dow === 5;
                return (
                  <div key={day} className="flex-1 text-center">
                    {show ? (
                      <span className="text-[8px] font-mono text-slate-700">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dow]}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* E. Fluency trend — blocks per minute */}
          {recentBpms.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-semibold text-sm">
                    Recent sessions
                  </h2>
                  <span className="text-[10px] font-mono text-slate-600">
                    blocks / min &mdash; lower is better
                  </span>
                </div>
                {latestBpm !== null && (
                  <span
                    className={`text-2xl font-bold tabular-nums ${bpmColor(latestBpm)}`}
                  >
                    {latestBpm.toFixed(1)}
                    <span className="text-xs font-normal text-slate-500 ml-1">
                      bpm
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-end gap-2 h-20">
                {recentBpms.map((bpm, i) => {
                  const heightPct = Math.max(8, (bpm / bpmMax) * 100);
                  const opacity =
                    0.6 +
                    (i / Math.max(1, recentBpms.length - 1)) * 0.4;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col justify-end"
                      title={`${bpm.toFixed(1)} blocks/min`}
                    >
                      <div
                        style={{ height: `${heightPct}%`, opacity }}
                        className={`rounded-sm ${bpmBarColor(i)}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-700">
                  oldest
                </span>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] font-mono text-slate-700">
                  most recent
                </span>
              </div>
            </div>
          )}

          {/* F. Recent session history */}
          {recentSessions.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">
                  Recent sessions
                </h2>
                <Link
                  href="/dashboard/analytics"
                  className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  View all &#8594;
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-800/60">
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                        Date
                      </th>
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                        Blocks detected
                      </th>
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                        Blocks / min
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {recentSessions.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                          {new Date(s.created_at).toLocaleString('en-GB', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-6 py-3 text-slate-300 text-xs">
                          {formatDuration(s.duration_seconds)}
                        </td>
                        <td className="px-6 py-3 text-slate-300 text-xs">
                          {s.total_blocks_detected}
                        </td>
                        <td
                          className={`px-6 py-3 text-xs font-semibold tabular-nums ${bpmColor(s.bpm)}`}
                        >
                          {s.bpm.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
