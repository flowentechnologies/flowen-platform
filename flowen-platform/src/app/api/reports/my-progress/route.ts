import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { generateReport } from '@/lib/pdf-report';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const admin = db();

    const [profileRes, sessionsRes, planRes] = await Promise.all([
      admin.from('profiles').select('display_name, email').eq('id', user.id).single(),
      admin.from('practice_sessions')
        .select('created_at, duration_seconds, total_blocks_detected, total_repetitions_detected, total_prolongations_detected, average_latency_ms')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        // Cap at 500 rows — more than any patient could realistically accumulate and
        // prevents a full-table scan from loading into the PDF generation process.
        .limit(500),
      admin.from('treatment_plans')
        .select('prescribed_stages, sessions_per_week, minutes_per_session, phase, goals, slp_user_id')
        .eq('patient_user_id', user.id)
        .eq('active', true)
        .maybeSingle(),
    ]);

    let slpName: string | null  = null;
    let slpEmail: string | null = null;
    if (planRes.data?.slp_user_id) {
      const { data: slp } = await admin.from('profiles').select('display_name, email').eq('id', planRes.data.slp_user_id).single();
      slpName  = slp?.display_name ?? slp?.email ?? null;
      slpEmail = slp?.email ?? null;
    }

    // Report period: first session → today
    const sessions = sessionsRes.data ?? [];
    const reportPeriod = sessions.length > 0
      ? `${new Date(sessions[0].created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '';

    const pdf = await generateReport({
      patientName:       profileRes.data?.display_name ?? user.email?.split('@')[0] ?? 'Me',
      patientEmail:      profileRes.data?.email ?? user.email ?? '',
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
      notes:             [],   // clinical notes are not included in patient self-download
    });

    return new Response(pdf.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="my-flowen-progress.pdf"',
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[reports/my-progress] error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
