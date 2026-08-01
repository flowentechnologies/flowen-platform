import { NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { evaluateAutoAdvance, PROGRAMME } from '@/lib/programme';

function db() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { duration_seconds: number; total_blocks_detected: number; stage_id: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const admin = db();

  const { data: inserted, error } = await admin.from('practice_sessions').insert({
    user_id: user.id,
    brand: 'flowen',
    duration_seconds: body.duration_seconds,
    total_blocks_detected: body.total_blocks_detected,
    total_repetitions_detected: 0,
    total_prolongations_detected: 0,
    average_latency_ms: null,
    stage_id: body.stage_id,
  }).select('id, created_at').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Evaluate auto-progression; skip if user has an active SLP treatment plan.
  // Fetch plan + programme in parallel, then query sessions since week_started_at
  // so that manual advancement resets the counter correctly.
  const [planCount, progRes] = await Promise.all([
    admin
      .from('treatment_plans')
      .select('id', { count: 'exact', head: true })
      .eq('patient_user_id', user.id)
      .eq('active', true),
    admin
      .from('user_programme')
      .select('current_week, completed_weeks, week_started_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const session = inserted ? { id: inserted.id, created_at: inserted.created_at } : null;

  if ((planCount.count ?? 0) > 0 || !progRes.data) {
    return NextResponse.json({ ok: true, session, progression: null });
  }

  const prog = progRes.data;
  const { data: weekSessionsData } = await admin
    .from('practice_sessions')
    .select('duration_seconds, total_blocks_detected')
    .eq('user_id', user.id)
    .gte('created_at', prog.week_started_at);

  const weekSessions = weekSessionsData ?? [];
  const currentWeek = Math.min(Math.max(prog.current_week, 1), PROGRAMME.length);
  const targetSessions = PROGRAMME[currentWeek - 1].targetSessions;

  const result = evaluateAutoAdvance(currentWeek, weekSessions.length, targetSessions, weekSessions);

  if (!result.advanced) {
    return NextResponse.json({ ok: true, session, progression: result });
  }

  await Promise.all([
    admin.from('user_programme').update({
      current_week: result.newWeek,
      completed_weeks: [...prog.completed_weeks, currentWeek],
      week_started_at: new Date().toISOString(),
    }).eq('user_id', user.id),
    admin.from('stage_progressions').insert({
      user_id: user.id,
      from_week: currentWeek,
      to_week: result.newWeek,
      sessions_count: weekSessions.length,
      avg_bpm: result.avgBpm != null ? Math.round(result.avgBpm * 100) / 100 : null,
    }),
  ]);

  return NextResponse.json({ ok: true, session, progression: result });
}
