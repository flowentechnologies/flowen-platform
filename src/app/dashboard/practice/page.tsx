import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PracticeClient } from './PracticeClient';
import type { UserTreatmentPlan } from '@/app/api/user/treatment-plan/route';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

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

  const [recentSessionsRes, countRes, planRes, weekSessionsRes] = await Promise.all([
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
    supabase.from('practice_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString()),
  ]);

  const totalSessions = countRes.count ?? 0;

  let treatmentPlan: UserTreatmentPlan | null = null;
  let recommendedStage = Math.min(5, Math.floor(totalSessions / 5) + 1);

  if (planRes.data) {
    const p = planRes.data;
    let slpName: string | null = null;
    if (p.slp_user_id) {
      const { data: slp } = await admin.from('profiles').select('display_name,email').eq('id', p.slp_user_id).single();
      slpName = slp?.display_name ?? slp?.email ?? null;
    }
    treatmentPlan = {
      prescribed_stages: p.prescribed_stages,
      sessions_per_week: p.sessions_per_week,
      minutes_per_session: p.minutes_per_session,
      phase: p.phase,
      goals: p.goals,
      slp_display_name: slpName,
      slp_email: null,
    };
    recommendedStage = p.prescribed_stages[0] ?? recommendedStage;
  }

  return (
    <PracticeClient
      recommendedStage={recommendedStage}
      treatmentPlan={treatmentPlan}
      sessionsThisWeek={weekSessionsRes.count ?? 0}
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
