import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { adminDb as db } from '@/lib/supabase/admin';

export interface PatientSession {
  id: string;
  stage_id: number | null;
  duration_seconds: number;
  total_blocks_detected: number;
  total_repetitions_detected: number;
  total_prolongations_detected: number;
  created_at: string;
  note: string | null;
}

export interface PatientDetail {
  id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
  assigned_at: string;
  sessions: PatientSession[];
}

async function getClinicianUser() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return null;
  const admin = db();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'clinician') return null;
  return user;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const clinician = await getClinicianUser();
  if (!clinician) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = db();

  const { data: assignment } = await admin
    .from('slp_assignments')
    .select('assigned_at')
    .eq('slp_user_id', clinician.id)
    .eq('patient_user_id', patientId)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [profileRes, sessionsRes, notesRes] = await Promise.all([
    admin.from('profiles').select('id, display_name, email, role').eq('id', patientId).single(),
    admin.from('practice_sessions')
      .select('id, stage_id, duration_seconds, total_blocks_detected, total_repetitions_detected, total_prolongations_detected, created_at')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      // Most-recent 500 sessions — prevents full-table scan on active patients.
      .limit(500),
    admin.from('slp_session_notes')
      .select('session_id, note')
      .eq('slp_user_id', clinician.id)
      // Matching cap — a clinician won't have notes beyond the 500 sessions above.
      .limit(500),
  ]);

  const noteMap = new Map((notesRes.data ?? []).map(n => [n.session_id, n.note]));
  const sessions: PatientSession[] = (sessionsRes.data ?? []).map(s => ({
    ...s,
    note: noteMap.get(s.id) ?? null,
  }));

  const detail: PatientDetail = {
    id: patientId,
    display_name: profileRes.data?.display_name ?? null,
    email: profileRes.data?.email ?? null,
    role: profileRes.data?.role ?? null,
    assigned_at: assignment.assigned_at,
    sessions,
  };

  return NextResponse.json(detail);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const clinician = await getClinicianUser();
  if (!clinician) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const admin = db();
  const { data: assignment } = await admin
    .from('slp_assignments')
    .select('id')
    .eq('slp_user_id', clinician.id)
    .eq('patient_user_id', patientId)
    .maybeSingle();
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { session_id: string; note: string };
  const { session_id, note } = body;
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 });

  // Verify the session belongs to the patient this clinician is assigned to,
  // preventing a clinician from attaching notes to another patient's sessions.
  const { data: sessionOwner } = await admin
    .from('practice_sessions')
    .select('id')
    .eq('id', session_id)
    .eq('user_id', patientId)
    .maybeSingle();
  if (!sessionOwner) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const { error } = await admin.from('slp_session_notes').upsert(
    { session_id, slp_user_id: clinician.id, note: note ?? '', updated_at: new Date().toISOString() },
    { onConflict: 'session_id,slp_user_id' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
