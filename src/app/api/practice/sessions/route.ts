import { NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/lib/supabase/from-request';
import { evaluateAutoAdvance, PROGRAMME } from '@/lib/programme';

function db() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET — recent sessions for BPM history ────────────────────────────────────

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url    = new URL(req.url);
  const rawN   = parseInt(url.searchParams.get('n') ?? '10', 10);
  const n      = Number.isFinite(rawN) && rawN >= 1 && rawN <= 50 ? rawN : 10;

  const { data, error } = await db()
    .from('practice_sessions')
    .select('id, duration_seconds, total_blocks_detected, created_at, stage_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(n);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute BPM per session and return lightest possible payload
  const sessions = (data ?? []).map(s => ({
    id:              s.id,
    created_at:      s.created_at,
    duration_seconds: s.duration_seconds,
    blocks:          s.total_blocks_detected,
    bpm:             s.duration_seconds > 0
      ? Math.round((s.total_blocks_detected / (s.duration_seconds / 60)) * 100) / 100
      : 0,
    stage_id:        s.stage_id,
  }));

  return NextResponse.json({ sessions });
}

// ── POST — save a new session ─────────────────────────────────────────────────

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    duration_seconds: number;
    total_blocks_detected: number;
    total_repetitions_detected?: number;
    total_prolongations_detected?: number;
    stage_id: number;
    transcript?: string;
    /** Mean round-trip latency in ms across all ASR frames in this session.
     *  Client-side instrumentation measures time from audio capture to first
     *  transcript token and averages across the session. */
    average_latency_ms?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { duration_seconds, total_blocks_detected, total_repetitions_detected, total_prolongations_detected, stage_id, transcript, average_latency_ms } = body;
  if (
    typeof duration_seconds !== 'number' || !Number.isFinite(duration_seconds) || duration_seconds < 5 || duration_seconds > 7200 ||
    typeof total_blocks_detected !== 'number' || !Number.isInteger(total_blocks_detected) || total_blocks_detected < 0 ||
    (total_repetitions_detected !== undefined && (!Number.isInteger(total_repetitions_detected) || total_repetitions_detected < 0)) ||
    (total_prolongations_detected !== undefined && (!Number.isInteger(total_prolongations_detected) || total_prolongations_detected < 0)) ||
    (stage_id !== undefined && stage_id !== null && (!Number.isInteger(stage_id) || stage_id < 1)) ||
    (transcript !== undefined && typeof transcript !== 'string') ||
    (average_latency_ms !== undefined && (typeof average_latency_ms !== 'number' || !Number.isFinite(average_latency_ms) || average_latency_ms < 0 || average_latency_ms > 30_000))
  ) {
    return NextResponse.json({ error: 'Invalid session data' }, { status: 400 });
  }

  // Cap transcript length so a runaway client can't write an unbounded TEXT blob.
  const transcriptValue = typeof transcript === 'string'
    ? transcript.trim().slice(0, 20_000) || null
    : null;

  const admin = db();

  const { data: inserted, error } = await admin.from('practice_sessions').insert({
    user_id: user.id,
    brand: 'flowen',
    duration_seconds: body.duration_seconds,
    total_blocks_detected: body.total_blocks_detected,
    total_repetitions_detected:   body.total_repetitions_detected   ?? 0,
    total_prolongations_detected: body.total_prolongations_detected ?? 0,
    average_latency_ms: average_latency_ms ?? null,
    stage_id: body.stage_id,
    transcript: transcriptValue,
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
