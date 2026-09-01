import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PracticeClient } from './PracticeClient';
import { PracticePaywall } from './PracticePaywall';
import type { UserTreatmentPlan } from '@/app/api/user/treatment-plan/route';
import { computeProgrammeState, weekForSessionCount } from '@/lib/programme';
import { adminDb } from '@/lib/supabase/admin';

/** Free-tier session allowance before the paywall kicks in. */
const FREE_SESSION_LIMIT = 3;

export default async function PracticePage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const admin = adminDb();

  const [recentSessionsRes, countRes, planRes, profileRes, subscriptionRes] = await Promise.all([
    supabase.from('practice_sessions')
      .select('id,duration_seconds,total_blocks_detected,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('practice_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    admin.from('treatment_plans')
      .select('prescribed_stages,sessions_per_week,minutes_per_session,phase,goals,slp_user_id')
      .eq('patient_user_id', user.id)
      .eq('active', true)
      .maybeSingle(),
    admin.from('profiles')
      .select('consent_data_collection,tier')
      .eq('id', user.id)
      .maybeSingle(),
    admin.from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .limit(1)
      .maybeSingle(),
  ]);

  const totalSessions = countRes.count ?? 0;

  // ── Paywall gate ─────────────────────────────────────────────────────────────
  // Founding members and anyone with an active / trialing / past_due subscription
  // always have full access. Free users get FREE_SESSION_LIMIT taster sessions,
  // then see the upgrade paywall.
  const isFounding    = profileRes.data?.tier === 'founding';
  const hasActiveSub  = !!subscriptionRes.data;
  const paywallActive = !isFounding && !hasActiveSub && totalSessions >= FREE_SESSION_LIMIT;

  if (paywallActive) {
    // Fetch all sessions for value-anchor stats (≤ FREE_SESSION_LIMIT rows, cheap)
    const { data: allSessions } = await supabase
      .from('practice_sessions')
      .select('created_at,total_blocks_detected,duration_seconds')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    const sessions = allSessions ?? [];

    // Streak — consecutive days ending today
    const uniqueDays = [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse();
    let streak = 0;
    let cur = new Date(); cur.setHours(0, 0, 0, 0);
    for (const day of uniqueDays) {
      const d = new Date(day);
      if (Math.round((cur.getTime() - d.getTime()) / 86400_000) > 1) break;
      streak++; cur = d;
    }

    // Days since first session
    const firstSess = sessions[0];
    const daysActive = firstSess
      ? Math.max(1, Math.floor((Date.now() - new Date(firstSess.created_at).getTime()) / 86400_000))
      : 1;

    // BPM improvement: first session vs last session (positive = fewer blocks/min = better)
    const lastSess = sessions[sessions.length - 1];
    let bpmImprovement: number | null = null;
    if (firstSess && lastSess && firstSess.created_at !== lastSess.created_at) {
      const firstBpm = firstSess.duration_seconds > 0
        ? firstSess.total_blocks_detected / (firstSess.duration_seconds / 60) : null;
      const lastBpm  = lastSess.duration_seconds > 0
        ? lastSess.total_blocks_detected  / (lastSess.duration_seconds  / 60) : null;
      if (firstBpm !== null && lastBpm !== null) bpmImprovement = firstBpm - lastBpm;
    }

    return (
      <PracticePaywall
        sessionsUsed={totalSessions}
        freeLimit={FREE_SESSION_LIMIT}
        streak={streak}
        daysActive={daysActive}
        bpmImprovement={bpmImprovement}
      />
    );
  }

  let treatmentPlan: UserTreatmentPlan | null = null;
  let recommendedStage = Math.min(5, Math.floor(totalSessions / 5) + 1);
  let programmeBanner: { week: number; title: string; phase: string; stages: number[]; targetSessions: number; sessionsThisWeek: number; tip: string } | null = null;
  let sessionsThisWeek = 0;

  if (planRes.data) {
    const p = planRes.data;
    // Count sessions this week using the treatment plan rolling 7-day window
    const { count: weekCount } = await admin.from('practice_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString());
    sessionsThisWeek = weekCount ?? 0;

    let slpName: string | null = null;
    let slpEmail: string | null = null;
    if (p.slp_user_id) {
      const { data: slp } = await admin.from('profiles').select('display_name,email').eq('id', p.slp_user_id).single();
      slpName  = slp?.display_name ?? slp?.email ?? null;
      slpEmail = slp?.email ?? null;
    }
    treatmentPlan = {
      prescribed_stages: p.prescribed_stages,
      sessions_per_week: p.sessions_per_week,
      minutes_per_session: p.minutes_per_session,
      phase: p.phase,
      goals: p.goals,
      slp_display_name: slpName,
      slp_email: slpEmail,
    };
    recommendedStage = p.prescribed_stages[0] ?? recommendedStage;
  } else {
    // Self-guided programme — count sessions since week_started_at, not rolling window
    const progRes = await admin.from('user_programme').select('*').eq('user_id', user.id).maybeSingle();
    let prog = progRes.data;
    if (!prog) {
      const seedWeek = weekForSessionCount(totalSessions);
      const { data: inserted } = await admin.from('user_programme').upsert({
        user_id: user.id, current_week: seedWeek,
        week_started_at: new Date().toISOString(),
        completed_weeks: Array.from({ length: seedWeek - 1 }, (_, i) => i + 1),
        started_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).select().single();
      prog = inserted;
    }
    if (prog) {
      const { count: weekCount } = await admin.from('practice_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', prog.week_started_at);
      sessionsThisWeek = weekCount ?? 0;

      const state = computeProgrammeState(prog.current_week, prog.week_started_at, prog.completed_weeks, sessionsThisWeek);
      recommendedStage = state.week.stages[0] ?? recommendedStage;
      programmeBanner = {
        week: state.currentWeek,
        title: state.week.title,
        phase: state.week.phase,
        stages: state.week.stages,
        targetSessions: state.week.targetSessions,
        sessionsThisWeek,
        tip: state.week.tip,
      };
    }
  }

  const consentDataCollection = profileRes.data?.consent_data_collection ?? false;


  return (
    <PracticeClient
      recommendedStage={recommendedStage}
      treatmentPlan={treatmentPlan}
      programmeBanner={programmeBanner}
      sessionsThisWeek={sessionsThisWeek}
      consentDataCollection={consentDataCollection}
      recentSessions={(recentSessionsRes.data ?? []).map(s => ({
        id: s.id,
        duration_seconds: s.duration_seconds,
        total_blocks_detected: s.total_blocks_detected,
        created_at: s.created_at,
        bpm: s.duration_seconds > 0
          ? Math.round((s.total_blocks_detected / (s.duration_seconds / 60)) * 10) / 10
          : 0,
      }))}
    />
  );
}
