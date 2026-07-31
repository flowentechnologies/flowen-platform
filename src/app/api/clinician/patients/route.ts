import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export interface PatientSummary {
  id: string;
  display_name: string | null;
  email: string | null;
  assigned_at: string;
  totalSessions: number;
  lastSessionAt: string | null;
  totalMins: number;
  recentBpm: number | null;
  trend: 'improving' | 'plateauing' | 'regressing' | 'insufficient_data';
  improvementPct: number | null;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function computeTrend(sessions: { duration_seconds: number; total_blocks_detected: number }[]): {
  trend: PatientSummary['trend'];
  recentBpm: number | null;
  improvementPct: number | null;
} {
  if (sessions.length < 6) return { trend: 'insufficient_data', recentBpm: null, improvementPct: null };
  const bpm = (s: { duration_seconds: number; total_blocks_detected: number }) =>
    s.duration_seconds > 0 ? s.total_blocks_detected / (s.duration_seconds / 60) : 0;
  const first3 = sessions.slice(0, 3).map(bpm);
  const last3  = sessions.slice(-3).map(bpm);
  const baselineBpm = first3.reduce((a, b) => a + b, 0) / 3;
  const recentBpm   = last3.reduce((a, b) => a + b, 0) / 3;
  if (baselineBpm === 0) return { trend: 'insufficient_data', recentBpm, improvementPct: null };
  const improvementPct = ((baselineBpm - recentBpm) / baselineBpm) * 100;
  const trend = improvementPct > 10 ? 'improving' : improvementPct < -10 ? 'regressing' : 'plateauing';
  return { trend, recentBpm: Math.round(recentBpm * 10) / 10, improvementPct: Math.round(improvementPct * 10) / 10 };
}

export async function GET() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = db();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'clinician') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: assignments } = await admin
    .from('slp_assignments')
    .select('patient_user_id, assigned_at')
    .eq('slp_user_id', user.id);

  if (!assignments?.length) return NextResponse.json({ patients: [] });

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

  const patients: PatientSummary[] = assignments.map(a => {
    const p = profileMap.get(a.patient_user_id);
    const sessions = sessionsByUser.get(a.patient_user_id) ?? [];
    const totalMins = Math.round(sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60);
    const lastSessionAt = sessions.length ? sessions[sessions.length - 1].created_at : null;
    const { trend, recentBpm, improvementPct } = computeTrend(sessions);
    return {
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
    };
  });

  return NextResponse.json({ patients });
}
