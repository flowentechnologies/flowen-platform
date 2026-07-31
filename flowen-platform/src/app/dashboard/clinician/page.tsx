import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ClinicianClient } from './ClinicianClient';
import type { PatientSummary } from '@/app/api/clinician/patients/route';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function ClinicianPage() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) redirect('/auth/login');

  const admin = db();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'clinician') redirect('/dashboard');

  const { data: assignments } = await admin
    .from('slp_assignments')
    .select('patient_user_id, assigned_at')
    .eq('slp_user_id', user.id);

  const patients: PatientSummary[] = [];

  if (assignments?.length) {
    const patientIds = assignments.map(a => a.patient_user_id);
    const [profilesRes, sessionsRes] = await Promise.all([
      admin.from('profiles').select('id, display_name, email').in('id', patientIds),
      admin.from('practice_sessions')
        .select('user_id, duration_seconds, total_blocks_detected, created_at')
        .in('user_id', patientIds)
        .order('created_at', { ascending: true }),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
    const sessionsByUser = new Map<string, { duration_seconds: number; total_blocks_detected: number; created_at: string }[]>();
    for (const s of (sessionsRes.data ?? [])) {
      if (!sessionsByUser.has(s.user_id)) sessionsByUser.set(s.user_id, []);
      sessionsByUser.get(s.user_id)!.push(s);
    }

    for (const a of assignments) {
      const p = profileMap.get(a.patient_user_id);
      const sessions = sessionsByUser.get(a.patient_user_id) ?? [];
      const totalMins = Math.round(sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);
      const lastSessionAt = sessions.length ? sessions[sessions.length - 1].created_at : null;

      let trend: PatientSummary['trend'] = 'insufficient_data';
      let recentBpm: number | null = null;
      let improvementPct: number | null = null;

      if (sessions.length >= 6) {
        const bpm = (s: { duration_seconds: number; total_blocks_detected: number }) =>
          s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
        const baselineBpm = sessions.slice(0, 3).map(bpm).reduce((a, b) => a + b, 0) / 3;
        const avgRecent   = sessions.slice(-3).map(bpm).reduce((a, b) => a + b, 0) / 3;
        recentBpm = Math.round(avgRecent * 10) / 10;
        if (baselineBpm > 0) {
          improvementPct = Math.round(((baselineBpm - avgRecent) / baselineBpm) * 100 * 10) / 10;
          trend = improvementPct > 10 ? 'improving' : improvementPct < -10 ? 'regressing' : 'plateauing';
        }
      }

      patients.push({
        id: a.patient_user_id,
        display_name: p?.display_name ?? null,
        email: p?.email ?? null,
        assigned_at: a.assigned_at,
        totalSessions: sessions.length,
        lastSessionAt,
        totalMins,
        recentBpm,
        trend,
        improvementPct,
      });
    }
  }

  return <ClinicianClient patients={patients} />;
}
