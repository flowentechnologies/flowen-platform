import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export interface TreatmentPlan {
  id: string;
  prescribed_stages: number[];
  sessions_per_week: number;
  minutes_per_session: number;
  phase: string;
  goals: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getClinicianAndVerifyAssignment(patientId: string) {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return null;
  const admin = db();
  const [{ data: profile }, { data: assignment }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', user.id).single(),
    admin.from('slp_assignments').select('id').eq('slp_user_id', user.id).eq('patient_user_id', patientId).maybeSingle(),
  ]);
  if (profile?.role !== 'clinician' || !assignment) return null;
  return user;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const clinician = await getClinicianAndVerifyAssignment(patientId);
  if (!clinician) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data } = await db()
    .from('treatment_plans')
    .select('*')
    .eq('slp_user_id', clinician.id)
    .eq('patient_user_id', patientId)
    .maybeSingle();

  return NextResponse.json({ plan: data ?? null });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ patientId: string }> },
) {
  const { patientId } = await params;
  const clinician = await getClinicianAndVerifyAssignment(patientId);
  if (!clinician) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as Partial<TreatmentPlan>;
  const admin = db();

  const { data, error } = await admin.from('treatment_plans').upsert(
    {
      slp_user_id: clinician.id,
      patient_user_id: patientId,
      prescribed_stages: body.prescribed_stages ?? [1],
      sessions_per_week: body.sessions_per_week ?? 3,
      minutes_per_session: body.minutes_per_session ?? 10,
      phase: body.phase ?? 'Establishment',
      goals: body.goals ?? null,
      active: body.active ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slp_user_id,patient_user_id' },
  ).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ plan: data });
}
