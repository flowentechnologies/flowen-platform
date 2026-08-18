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
  const { data: profile } = await admin.from('profiles').select('role, is_admin').eq('id', user.id).single();

  const isSLP   = profile?.role === 'clinician';
  const isAdmin = profile?.is_admin === true;

  if (!isSLP && !isAdmin) return new Response('Forbidden', { status: 403 });

  if (isSLP && !isAdmin) {
    const { data: assignment } = await admin
      .from('slp_assignments')
      .select('id')
      .eq('slp_user_id', user.id)
      .eq('patient_user_id', patientId)
      .maybeSingle();
    if (!assignment) return new Response('Not found', { status: 404 });
  }

  const [patientRes, sessionsRes, planRes] = await Promise.all([
    admin.from('profiles').select('display_name, email').eq('id', patientId).single(),
    admin.from('practice_sessions')
      .select('created_at, duration_seconds, total_blocks_detected')
      .eq('user_id', patientId)
      .order('created_at', { ascending: true }),
    admin.from('treatment_plans')
      .select('prescribed_stages, sessions_per_week, minutes_per_session, phase, goals, slp_user_id')
      .eq('patient_user_id', patientId)
      .eq('active', true)
      .maybeSingle(),
  ]);

  let slpName: string | null = null;
  if (planRes.data?.slp_user_id) {
    const { data: slp } = await admin.from('profiles').select('display_name, email').eq('id', planRes.data.slp_user_id).single();
    slpName = slp?.display_name ?? slp?.email ?? null;
  }

  const pdf = await generateReport({
    patientName:      patientRes.data?.display_name ?? patientRes.data?.email?.split('@')[0] ?? 'Unknown',
    patientEmail:     patientRes.data?.email ?? '',
    clinicianName:    slpName,
    reportDate:       new Date().toLocaleDateString('en-GB', { dateStyle: 'long' }),
    phase:            planRes.data?.phase ?? null,
    prescribedStages: planRes.data?.prescribed_stages ?? [],
    sessionsPerWeek:  planRes.data?.sessions_per_week ?? null,
    minutesPerSession:planRes.data?.minutes_per_session ?? null,
    goals:            planRes.data?.goals ?? null,
    sessions:         sessionsRes.data ?? [],
  });

  const slug = (patientRes.data?.display_name ?? 'patient').toLowerCase().replace(/\s+/g, '-');
  return new Response(pdf.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="flowen-report-${slug}.pdf"`,
    },
  });
}
