import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

type Session = {
  id: string;
  duration_seconds: number;
  total_blocks_detected: number;
  total_repetitions_detected: number;
  total_prolongations_detected: number;
  created_at: string;
};

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

export default async function AnalyticsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: rawSessions } = await supabase
    .from('practice_sessions')
    .select(
      'id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const sessions = (rawSessions ?? []) as Session[];
  const n = sessions.length;

  // Summary KPIs
  const totalMins = Math.round(
    sessions.reduce((s, r) => s + r.duration_seconds, 0) / 60
  );

  const bpms = sessions.map((s) =>
    s.duration_seconds > 0
      ? s.total_blocks_detected / (s.duration_seconds / 60)
      : 0
  );

  const avgBpm =
    bpms.length > 0
      ? (bpms.reduce((a, b) => a + b, 0) / bpms.length).toFixed(1)
      : null;

  const avgDurationSecs =
    n > 0
      ? Math.round(sessions.reduce((s, r) => s + r.duration_seconds, 0) / n)
      : 0;

  // Display newest first
  const sessionsByNewest = [...sessions].reverse();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-white">Session history</h1>
        <p className="text-slate-400 text-sm mt-1">
          {n === 0
            ? 'No sessions recorded yet.'
            : `${n} session${n !== 1 ? 's' : ''} total`}
        </p>
      </div>

      {n === 0 ? (
        /* Empty state */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <p className="text-white font-semibold text-lg">No sessions yet.</p>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Complete a practice session to see your history here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Total sessions',
                value: String(n),
                sub: 'lifetime',
              },
              {
                label: 'Practice time',
                value: `${totalMins}m`,
                sub: 'total',
              },
              {
                label: 'Avg blocks / min',
                value: avgBpm !== null ? avgBpm : '—',
                sub: 'all time',
              },
              {
                label: 'Avg duration',
                value: formatDuration(avgDurationSecs),
                sub: 'per session',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
                  {card.label}
                </span>
                <span className="text-3xl font-bold text-white leading-none">
                  {card.value}
                </span>
                <span className="text-slate-400 text-xs">{card.sub}</span>
              </div>
            ))}
          </div>

          {/* Full session history table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold text-sm">All sessions</h2>
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
                      Blocks
                    </th>
                    <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                      Reps
                    </th>
                    <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                      Prolongations
                    </th>
                    <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-600">
                      Blocks / min
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sessionsByNewest.map((s) => {
                    const bpm =
                      s.duration_seconds > 0
                        ? s.total_blocks_detected / (s.duration_seconds / 60)
                        : 0;
                    return (
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
                        <td className="px-6 py-3 text-slate-300 text-xs">
                          {s.total_repetitions_detected}
                        </td>
                        <td className="px-6 py-3 text-slate-300 text-xs">
                          {s.total_prolongations_detected}
                        </td>
                        <td
                          className={`px-6 py-3 text-xs font-semibold tabular-nums ${bpmColor(bpm)}`}
                        >
                          {bpm.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
