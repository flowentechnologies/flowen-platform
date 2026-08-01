import type { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardClient } from './DashboardClient';
import { computeProgrammeState, weekForSessionCount, type ProgrammeState } from '@/lib/programme';

export const metadata: Metadata = {
  title: 'Dashboard | Flowen',
  robots: { index: false, follow: false },
};

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

type Session = {
  id: string;
  duration_seconds: number;
  total_blocks_detected: number;
  total_repetitions_detected: number;
  total_prolongations_detected: number;
  created_at: string;
};

export default async function DashboardPage() {
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

  const admin = adminDb();
  const weekStart = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [sessionsRes, profileRes, progRes, weekCountRes, hasPlanRes] = await Promise.all([
    supabase
      .from('practice_sessions')
      .select('id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('display_name,tier').eq('id', user.id).single(),
    admin.from('user_programme').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('practice_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekStart),
    admin.from('treatment_plans').select('id', { count: 'exact', head: true }).eq('patient_user_id', user.id).eq('active', true),
  ]);

  const sessions = (sessionsRes.data ?? []) as Session[];
  const profile = profileRes.data;
  const n = sessions.length;
  const hasTreatmentPlan = (hasPlanRes.count ?? 0) > 0;

  // Programme state — only shown when user has no clinician-assigned plan
  let programmeState: ProgrammeState | null = null;
  if (!hasTreatmentPlan) {
    let prog = progRes.data;
    if (!prog) {
      const seedWeek = weekForSessionCount(n);
      const { data: inserted } = await admin.from('user_programme').upsert({
        user_id: user.id,
        current_week: seedWeek,
        week_started_at: new Date().toISOString(),
        completed_weeks: Array.from({ length: seedWeek - 1 }, (_, i) => i + 1),
        started_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).select().single();
      prog = inserted;
    }
    if (prog) {
      // Count sessions since this programme week started (not a rolling 7-day window)
      // so that manual or auto-advancement resets the counter correctly.
      const sessionsThisWeek = sessions.filter(s => s.created_at >= prog!.week_started_at).length;
      programmeState = computeProgrammeState(prog.current_week, prog.week_started_at, prog.completed_weeks, sessionsThisWeek);
    }
  }

  // Total practice time
  const totalMins = Math.round(
    sessions.reduce((s, r) => s + r.duration_seconds, 0) / 60
  );

  // Streak: count consecutive days ending today or yesterday with ≥1 session
  const practiceDays = new Set(sessions.map((s) => s.created_at.slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (practiceDays.has(key)) streak++;
    else if (i > 0) break;
  }

  // bpm for each session
  const bpms = sessions.map((s) =>
    s.duration_seconds > 0
      ? s.total_blocks_detected / (s.duration_seconds / 60)
      : 0
  );

  // Trajectory
  let improvementPct: number | null = null;
  let trend: 'improving' | 'plateauing' | 'regressing' | 'no_data' = 'no_data';
  if (n >= 3) {
    const baseline = bpms.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const recent = bpms.slice(-3).reduce((a, b) => a + b, 0) / 3;
    improvementPct =
      baseline > 0
        ? Math.round(((recent - baseline) / baseline) * 100)
        : 0;
    trend =
      improvementPct < -10
        ? 'improving'
        : improvementPct > 10
        ? 'regressing'
        : 'plateauing';
  }

  // Sessions by day (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const sessionsByDay: Record<string, number> = {};
  for (const s of sessions.filter((s) => s.created_at >= thirtyDaysAgo)) {
    const day = s.created_at.slice(0, 10);
    sessionsByDay[day] = (sessionsByDay[day] ?? 0) + 1;
  }

  // Last 8 sessions for mini-chart (most recent last)
  const recentBpms = bpms.slice(-8);

  // Last 5 sessions for history list (most recent first)
  const recentSessions = sessions.slice(-5).reverse();

  return (
    <DashboardClient
      displayName={profile?.display_name ?? user.email?.split('@')[0] ?? 'there'}
      tier={profile?.tier ?? null}
      sessionCount={n}
      totalMins={totalMins}
      streak={streak}
      trend={trend}
      improvementPct={improvementPct}
      sessionsByDay={sessionsByDay}
      recentBpms={recentBpms}
      programmeState={programmeState}
      recentSessions={recentSessions.map((s) => ({
        id: s.id,
        created_at: s.created_at,
        duration_seconds: s.duration_seconds,
        total_blocks_detected: s.total_blocks_detected,
        bpm:
          s.duration_seconds > 0
            ? Math.round(
                (s.total_blocks_detected / (s.duration_seconds / 60)) * 10
              ) / 10
            : 0,
      }))}
    />
  );
}
