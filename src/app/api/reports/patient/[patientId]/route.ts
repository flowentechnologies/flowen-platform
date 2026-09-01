import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateReport } from '@/lib/pdf-report';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;

  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const admin = db();
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, is_admin, display_name, email')
    .eq('id', user.id)
    .single();

  const isSLP   = callerProfile?.role === 'slp';
  const isAdmin = callerProfile?.is_admin === true;

  if (!isSLP && !isAdmin) return new Response('Forbidden', { status: 403 });

  // SLPs can only download reports for their own assigned patients
  if (isSLP && !isAdmin) {
    const { data: assignment } = await admin
      .from('slp_assignments')
      .select('id')
      .eq('slp_user_id', user.id)
      .eq('patient_user_id', patientId)
      .maybeSingle();
    if (!assignment) return new Response('Not found', { status: 404 });
  }

  const [patientRes, sessionsRes, planRes, notesRes] = await Promise.all([
    admin.from('profiles').select('display_name, email').eq('id', patientId).single(),
    admin
      .from('practice_sessions')
      .select('created_at, duration_seconds, total_blocks_detected, total_repetitions_detected, total_prolongations_detected, average_latency_ms')
      .eq('user_id', patientId)
      .order('created_at', { ascending: true }),
    admin
      .from('treatment_plans')
      .select('prescribed_stages, sessions_per_week, minutes_per_session, phase, goals, slp_user_id')
      .eq('patient_user_id', patientId)
      .eq('active', true)
      .maybeSingle(),
    // Clinical notes for this patient — from the requesting SLP (or all SLPs for admins)
    isSLP
      ? admin
          .from('slp_session_notes')
          .select('note, created_at')
          .eq('slp_user_id', user.id)
          .eq('patient_user_id', patientId)
          .order('created_at', { ascending: false })
          .limit(50)
      : admin
          .from('slp_session_notes')
          .select('note, created_at')
          .eq('patient_user_id', patientId)
          .order('created_at', { ascending: false })
          .limit(50),
  ]);

  // Resolve the responsible clinician's name and email
  let slpName: string | null  = null;
  let slpEmail: string | null = null;
  const slpUserId = planRes.data?.slp_user_id ?? (isSLP ? user.id : null);
  if (slpUserId) {
    const { data: slp } = await admin
      .from('profiles')
      .select('display_name, email')
      .eq('id', slpUserId)
      .single();
    slpName  = slp?.display_name ?? slp?.email ?? null;
    slpEmail = slp?.email ?? null;
  }

  // Report period: first session → today
  const sessions = sessionsRes.data ?? [];
  const reportPeriod = sessions.length > 0
    ? `${new Date(sessions[0].created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  const pdf = await generateReport({
    patientName:       patientRes.data?.display_name ?? patientRes.data?.email?.split('@')[0] ?? 'Unknown',
    patientEmail:      patientRes.data?.email ?? '',
    clinicianName:     slpName,
    clinicianEmail:    slpEmail,
    reportDate:        new Date().toLocaleDateString('en-GB', { dateStyle: 'long' }),
    reportPeriod,
    phase:             planRes.data?.phase ?? null,
    prescribedStages:  planRes.data?.prescribed_stages ?? [],
    sessionsPerWeek:   planRes.data?.sessions_per_week ?? null,
    minutesPerSession: planRes.data?.minutes_per_session ?? null,
    goals:             planRes.data?.goals ?? null,
    sessions,
    notes:             notesRes.data ?? [],
  });

  const slug = (patientRes.data?.display_name ?? 'patient').toLowerCase().replace(/\s+/g, '-');
  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="flowen-progress-${slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
