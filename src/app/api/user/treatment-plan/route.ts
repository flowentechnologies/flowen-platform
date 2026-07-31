import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export interface UserTreatmentPlan {
  prescribed_stages: number[];
  sessions_per_week: number;
  minutes_per_session: number;
  phase: string;
  goals: string | null;
  slp_display_name: string | null;
  slp_email: string | null;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
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
  const { data: plan } = await admin
    .from('treatment_plans')
    .select('prescribed_stages,sessions_per_week,minutes_per_session,phase,goals,slp_user_id')
    .eq('patient_user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (!plan) return NextResponse.json({ plan: null });

  const { data: slpProfile } = await admin
    .from('profiles')
    .select('display_name, email')
    .eq('id', plan.slp_user_id)
    .single();

  const result: UserTreatmentPlan = {
    prescribed_stages: plan.prescribed_stages,
    sessions_per_week: plan.sessions_per_week,
    minutes_per_session: plan.minutes_per_session,
    phase: plan.phase,
    goals: plan.goals,
    slp_display_name: slpProfile?.display_name ?? null,
    slp_email: slpProfile?.email ?? null,
  };

  return NextResponse.json({ plan: result });
}
