import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';

// ── Data client ───────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function fmtDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Bar chart (server-rendered CSS) ──────────────────────────────────────────

function DayBars({
  days,
  countsByDay,
  color = 'bg-emerald-500',
}: {
  days: string[];
  countsByDay: Record<string, number>;
  color?: string;
}) {
  const max = Math.max(...days.map(d => countsByDay[d] ?? 0), 1);
  return (
    <div className="flex items-end gap-px" style={{ height: 80 }}>
      {days.map(day => {
        const v = countsByDay[day] ?? 0;
        const h = Math.max(v > 0 ? (v / max) * 100 : 0, v > 0 ? 6 : 0);
        return (
          <div
            key={day}
            title={`${shortDate(day)}: ${v}`}
            style={{ height: `${h}%` }}
            className={`flex-1 rounded-t transition-all ${v > 0 ? `${color}/50 hover:${color}/80` : 'bg-slate-800/40'}`}
          />
        );
      })}
    </div>
  );
}

function AxisLabels({ days }: { days: string[] }) {
  const shown = [0, 6, 13, 20, 29] as const;
  return (
    <div className="relative mt-1" style={{ height: 16 }}>
      {shown.map(i => (
        <span
          key={i}
          className="absolute text-[9px] text-slate-600 font-mono -translate-x-1/2"
          style={{ left: `${(i / 29) * 100}%` }}
        >
          {shortDate(days[i])}
        </span>
      ))}
    </div>
  );
}

// ── Horizontal bar ────────────────────────────────────────────────────────────

function HBar({ pct: p, color = 'bg-emerald-500' }: { pct: number; color?: string }) {
  return (
    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(p, p > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

// ── Funnel step ───────────────────────────────────────────────────────────────

function FunnelStep({
  label,
  count,
  total,
  prevCount,
  color = 'bg-emerald-500',
}: {
  label: string;
  count: number;
  total: number;
  prevCount?: number;
  color?: string;
}) {
  const barPct = pct(count, total);
  const conv   = prevCount != null ? pct(count, prevCount) : null;
  return (
    <div className="flex items-center gap-4">
      <div className="w-40 shrink-0 text-right">
        <p className="text-sm font-bold text-white">{count.toLocaleString()}</p>
        <p className="text-[10px] text-slate-400">{label}</p>
      </div>
      <div className="flex-1 h-6 bg-slate-800 rounded-lg overflow-hidden">
        <div className={`h-full ${color}/40 rounded-lg`} style={{ width: `${Math.max(barPct, 1)}%` }} />
      </div>
      <div className="w-14 shrink-0 text-left">
        {conv !== null ? (
          <span className="text-[10px] font-mono text-slate-500">{conv}% conv.</span>
        ) : (
          <span className="text-[10px] font-mono text-emerald-400">{barPct}%</span>
        )}
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  valueColor = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-3xl font-black ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  await assertAdmin();

  const db = adminClient();
  const now = new Date();

  const thirtyDaysAgo  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo   = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [
    totalUsersRes,
    onboardedRes,
    activeSubsRes,
    waitlistRes,
    recentProfilesRes,
    recentWaitlistRes,
    tierRes,
    sessions30dRes,
    totalSessionsRes,
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('created_at').gte('created_at', sixtyDaysAgo),
    db.from('waitlist_signups').select('created_at').gte('created_at', thirtyDaysAgo),
    db.from('profiles').select('tier'),
    db.from('practice_sessions').select(
      'user_id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at',
    ).gte('created_at', thirtyDaysAgo),
    db.from('practice_sessions').select('*', { count: 'exact', head: true }),
  ]);

  // ── Raw counts ──────────────────────────────────────────────────────────────

  const totalUsers   = totalUsersRes.count   ?? 0;
  const onboarded    = onboardedRes.count    ?? 0;
  const activeSubs   = activeSubsRes.count   ?? 0;
  const waitlistTotal = waitlistRes.count    ?? 0;
  const totalSessions = totalSessionsRes.count ?? 0;

  // ── Profile trends ──────────────────────────────────────────────────────────

  const recentProfiles = (recentProfilesRes.data ?? []) as { created_at: string }[];
  const thisMonthSignups = recentProfiles.filter(p => p.created_at >= thisMonthStart).length;
  const lastMonthSignups = recentProfiles.filter(
    p => p.created_at >= lastMonthStart && p.created_at < thisMonthStart,
  ).length;
  const signupGrowthPct = lastMonthSignups > 0
    ? Math.round(((thisMonthSignups - lastMonthSignups) / lastMonthSignups) * 100)
    : thisMonthSignups > 0 ? 100 : 0;

  // Signup trend map (last 30 days)
  const signupsByDay: Record<string, number> = {};
  for (const p of recentProfiles) {
    const day = p.created_at.slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  }

  // ── Waitlist trend ──────────────────────────────────────────────────────────

  const waitlistByDay: Record<string, number> = {};
  for (const w of ((recentWaitlistRes.data ?? []) as { created_at: string }[])) {
    const day = w.created_at.slice(0, 10);
    waitlistByDay[day] = (waitlistByDay[day] ?? 0) + 1;
  }

  // ── Tier distribution ───────────────────────────────────────────────────────

  const tierCounts: Record<string, number> = {};
  for (const p of ((tierRes.data ?? []) as { tier: string | null }[])) {
    const t = p.tier ?? 'standard';
    tierCounts[t] = (tierCounts[t] ?? 0) + 1;
  }
  const tierOrder = ['founding', 'standard', 'public_funds', 'vocali_freemium'];
  const tierColors: Record<string, string> = {
    founding:       'bg-amber-400',
    standard:       'bg-sky-400',
    public_funds:   'bg-purple-400',
    vocali_freemium:'bg-slate-400',
  };
  const tierLabels: Record<string, string> = {
    founding:       'Founding Member',
    standard:       'Standard',
    public_funds:   'Public Funds / NHS',
    vocali_freemium:'Freemium',
  };

  // ── Sessions ────────────────────────────────────────────────────────────────

  interface SessionRow {
    user_id: string;
    duration_seconds: number;
    total_blocks_detected: number;
    total_repetitions_detected: number;
    total_prolongations_detected: number;
    created_at: string;
  }

  const sessions = (sessions30dRes.data ?? []) as SessionRow[];

  // DAU / MAU
  const dauUsers = new Set(sessions.filter(s => s.created_at >= todayStart).map(s => s.user_id));
  const mauUsers = new Set(sessions.map(s => s.user_id)); // already filtered to 30d
  const wauUsers = new Set(sessions.filter(s => s.created_at >= sevenDaysAgo).map(s => s.user_id));
  const dau = dauUsers.size;
  const mau = mauUsers.size;
  const wau = wauUsers.size;
  const dauMauRatio = mau > 0 ? ((dau / mau) * 100).toFixed(1) : '0.0';

  // Funnel: users who have practised
  const practicedUsers = mauUsers.size; // distinct in last 30d

  // Avg metrics
  const avgDuration  = sessions.length > 0 ? sessions.reduce((s, r) => s + r.duration_seconds, 0) / sessions.length : 0;
  const avgBlocks    = sessions.length > 0 ? sessions.reduce((s, r) => s + r.total_blocks_detected, 0) / sessions.length : 0;
  const avgReps      = sessions.length > 0 ? sessions.reduce((s, r) => s + r.total_repetitions_detected, 0) / sessions.length : 0;
  const avgProlong   = sessions.length > 0 ? sessions.reduce((s, r) => s + r.total_prolongations_detected, 0) / sessions.length : 0;
  const totalDisfluencies = avgBlocks + avgReps + avgProlong;

  // Sessions per day (last 30d)
  const sessionsByDay: Record<string, number> = {};
  for (const s of sessions) {
    const day = s.created_at.slice(0, 10);
    sessionsByDay[day] = (sessionsByDay[day] ?? 0) + 1;
  }

  // Sessions per practised user
  const sessionCountPerUser = new Map<string, number>();
  for (const s of sessions) {
    sessionCountPerUser.set(s.user_id, (sessionCountPerUser.get(s.user_id) ?? 0) + 1);
  }
  const avgSessionsPerUser = mau > 0
    ? (sessions.length / mau).toFixed(1)
    : '0.0';

  const days = last30Days();

  const generatedAt = now.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Funnels · Cohorts · Clinical outcomes · Engagement</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500 font-mono hidden sm:block">{generatedAt} (London)</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            LIVE DATA
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total Users"      value={totalUsers.toLocaleString()} />
        <Stat label="DAU"              value={dau.toLocaleString()}        sub="active today"            valueColor="text-emerald-400" />
        <Stat label="WAU"              value={wau.toLocaleString()}        sub="active 7 days"           valueColor="text-emerald-400" />
        <Stat label="MAU"              value={mau.toLocaleString()}        sub="active 30 days"          valueColor="text-emerald-400" />
        <Stat label="DAU/MAU"          value={`${dauMauRatio}%`}           sub="engagement ratio"        valueColor={parseFloat(dauMauRatio) >= 10 ? 'text-emerald-400' : 'text-amber-400'} />
        <Stat label="Total Sessions"   value={totalSessions.toLocaleString()} sub="all time"             valueColor="text-sky-400" />
      </div>

      {/* Acquisition funnel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-sm font-bold text-white">Acquisition Funnel</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            CONVERSION
          </span>
        </div>
        <div className="space-y-3">
          <FunnelStep label="Waitlist Signups" count={waitlistTotal}  total={waitlistTotal}   color="bg-sky-500" />
          <FunnelStep label="Registered"       count={totalUsers}     total={waitlistTotal}   prevCount={waitlistTotal}   color="bg-sky-500" />
          <FunnelStep label="Onboarded"        count={onboarded}      total={waitlistTotal}   prevCount={totalUsers}      color="bg-emerald-500" />
          <FunnelStep label="Subscribed"       count={activeSubs}     total={waitlistTotal}   prevCount={onboarded}       color="bg-emerald-500" />
          <FunnelStep label="Practised (30d)"  count={practicedUsers} total={waitlistTotal}   prevCount={activeSubs}      color="bg-amber-400" />
        </div>

        {/* Conversion summary */}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { label: 'Waitlist → Registered', value: `${pct(totalUsers, waitlistTotal)}%` },
            { label: 'Registered → Onboarded', value: `${pct(onboarded, totalUsers)}%` },
            { label: 'Onboarded → Subscribed', value: `${pct(activeSubs, onboarded)}%` },
            { label: 'Subscribed → Practised', value: `${pct(practicedUsers, activeSubs)}%` },
          ].map(c => (
            <div key={c.label} className="bg-slate-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <span className="text-[10px] text-slate-400">{c.label}</span>
              <span className="text-sm font-bold text-white font-mono">{c.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Signup trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">New Registrations (30d)</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-emerald-400">
                {signupGrowthPct > 0 ? '+' : ''}{signupGrowthPct}% MoM
              </span>
              <span className="text-[10px] text-slate-500">
                ({thisMonthSignups} this month)
              </span>
            </div>
          </div>
          <DayBars days={days} countsByDay={signupsByDay} color="bg-emerald-500" />
          <AxisLabels days={days} />
        </div>

        {/* Session activity */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Practice Sessions (30d)</h2>
            <span className="text-[10px] text-slate-500 font-mono">{sessions.length} total</span>
          </div>
          <DayBars days={days} countsByDay={sessionsByDay} color="bg-sky-500" />
          <AxisLabels days={days} />
        </div>
      </div>

      {/* Tier distribution + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tier distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-5">User Tier Distribution</h2>
          <div className="space-y-3">
            {tierOrder.map(tier => {
              const count = tierCounts[tier] ?? 0;
              const p = pct(count, totalUsers);
              return (
                <div key={tier} className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <p className="text-xs text-slate-300">{tierLabels[tier]}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{count} users</p>
                  </div>
                  <HBar pct={p} color={tierColors[tier]} />
                  <span className="w-8 text-right text-xs font-mono text-slate-400">{p}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Engagement metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold text-white mb-5">Engagement (30d)</h2>
          <div className="space-y-4">
            {[
              { label: 'Avg session duration',      value: fmtDuration(avgDuration),   sub: 'per completed session' },
              { label: 'Avg sessions per user',     value: avgSessionsPerUser,          sub: 'among active users (30d)' },
              { label: 'Onboarding completion',     value: `${pct(onboarded, totalUsers)}%`, sub: `${onboarded} of ${totalUsers} registered` },
              { label: 'Subscription conversion',   value: `${pct(activeSubs, onboarded)}%`, sub: `${activeSubs} paying subscribers` },
            ].map(m => (
              <div key={m.label} className="flex items-start justify-between gap-4 py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-xs text-slate-300">{m.label}</p>
                  <p className="text-[10px] text-slate-500">{m.sub}</p>
                </div>
                <span className="text-sm font-bold font-mono text-white shrink-0">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clinical metrics */}
      {sessions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-sm font-bold text-white">Clinical Outcomes (30d average)</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
              CLINICAL DATA
            </span>
            <span className="text-[10px] text-slate-500 font-mono">n = {sessions.length} sessions</span>
          </div>

          {/* Disfluency breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Blocks (avg/session)',        value: avgBlocks.toFixed(1),  color: 'text-red-400',    barColor: 'bg-red-500'   },
              { label: 'Repetitions (avg/session)',   value: avgReps.toFixed(1),    color: 'text-amber-400',  barColor: 'bg-amber-500' },
              { label: 'Prolongations (avg/session)', value: avgProlong.toFixed(1), color: 'text-sky-400',    barColor: 'bg-sky-500'   },
            ].map(d => (
              <div key={d.label} className="bg-slate-800/50 rounded-xl p-4">
                <p className="text-[10px] text-slate-400 mb-2">{d.label}</p>
                <p className={`text-2xl font-black ${d.color}`}>{d.value}</p>
                <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${d.barColor}/50 rounded-full`}
                    style={{ width: totalDisfluencies > 0 ? `${(parseFloat(d.value) / totalDisfluencies) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Disfluency type proportion */}
          {totalDisfluencies > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 font-mono mb-2 uppercase tracking-wide">Disfluency type proportion</p>
              <div className="flex h-4 rounded-full overflow-hidden gap-px">
                <div className="bg-red-500/60"    style={{ width: `${pct(avgBlocks,  totalDisfluencies)}%` }} title={`Blocks ${pct(avgBlocks, totalDisfluencies)}%`} />
                <div className="bg-amber-500/60"  style={{ width: `${pct(avgReps,    totalDisfluencies)}%` }} title={`Repetitions ${pct(avgReps, totalDisfluencies)}%`} />
                <div className="bg-sky-500/60"    style={{ width: `${pct(avgProlong, totalDisfluencies)}%` }} title={`Prolongations ${pct(avgProlong, totalDisfluencies)}%`} />
              </div>
              <div className="flex gap-4 mt-2">
                {[
                  { label: 'Blocks',        p: pct(avgBlocks,  totalDisfluencies), color: 'text-red-400'   },
                  { label: 'Repetitions',   p: pct(avgReps,    totalDisfluencies), color: 'text-amber-400' },
                  { label: 'Prolongations', p: pct(avgProlong, totalDisfluencies), color: 'text-sky-400'   },
                ].map(l => (
                  <span key={l.label} className={`text-[10px] font-mono ${l.color}`}>
                    {l.label} {l.p}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Growth summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white mb-5">Growth Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Signups this month',  value: thisMonthSignups.toString(),                          sub: `${signupGrowthPct > 0 ? '+' : ''}${signupGrowthPct}% vs last month` },
            { label: 'Signups last month',  value: lastMonthSignups.toString(),                          sub: 'calendar month' },
            { label: 'Waitlist total',      value: waitlistTotal.toLocaleString(),                       sub: 'pending access' },
            { label: 'Platform total',      value: (totalUsers + waitlistTotal).toLocaleString(),        sub: 'registered + waitlist' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-[10px] text-slate-400 mb-1">{s.label}</p>
              <p className="text-xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
