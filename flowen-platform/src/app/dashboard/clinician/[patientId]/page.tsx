import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { PatientClient } from './PatientClient';
import type { PatientDetail } from '@/app/api/clinician/patients/[patientId]/route';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;

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

  const { data: assignment } = await admin
    .from('slp_assignments')
    .select('assigned_at')
    .eq('slp_user_id', user.id)
    .eq('patient_user_id', patientId)
    .maybeSingle();
  if (!assignment) notFound();

  const [patientProfileRes, sessionsRes, notesRes] = await Promise.all([
    admin.from('profiles').select('id, display_name, email, role').eq('id', patientId).single(),
    admin.from('practice_sessions')
      .select('id, stage_id, duration_seconds, total_blocks_detected, total_repetitions_detected, total_prolongations_detected, created_at')
      .eq('user_id', patientId)
      .order('created_at', { ascending: true }),
    admin.from('slp_session_notes')
      .select('session_id, note')
      .eq('slp_user_id', user.id),
  ]);

  const noteMap = new Map((notesRes.data ?? []).map(n => [n.session_id, n.note as string]));

  const detail: PatientDetail = {
    id: patientId,
    display_name: patientProfileRes.data?.display_name ?? null,
    email: patientProfileRes.data?.email ?? null,
    role: patientProfileRes.data?.role ?? null,
    assigned_at: assignment.assigned_at,
    sessions: (sessionsRes.data ?? []).map(s => ({
      ...s,
      note: noteMap.get(s.id) ?? null,
    })),
  };

  return <PatientClient patient={detail} clinicianId={user.id} />;
}
