import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { computeProgrammeState, weekForSessionCount, PROGRAMME, type ProgrammeState } from '@/lib/programme';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getUser() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  return user;
}

export async function GET(): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = db();
  const weekStart = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [progRes, countRes, weekRes] = await Promise.all([
    admin.from('user_programme').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('practice_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    admin.from('practice_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekStart),
  ]);

  const totalSessions   = countRes.count ?? 0;
  const sessionsThisWeek = weekRes.count ?? 0;

  // Auto-create programme row if missing, seeding week from session count
  let prog = progRes.data;
  if (!prog) {
    const seedWeek = weekForSessionCount(totalSessions);
    const { data: inserted } = await admin.from('user_programme').upsert({
      user_id: user.id,
      current_week: seedWeek,
      week_started_at: new Date().toISOString(),
      completed_weeks: Array.from({ length: seedWeek - 1 }, (_, i) => i + 1),
      started_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single();
    prog = inserted;
  }

  if (!prog) return NextResponse.json({ error: 'Failed to load programme' }, { status: 500 });

  const state = computeProgrammeState(
    prog.current_week,
    prog.week_started_at,
    prog.completed_weeks,
    sessionsThisWeek,
  );

  return NextResponse.json(state);
}

export async function POST(req: Request): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { action: 'advance' | 'reset' };
  const admin = db();

  if (body.action === 'advance') {
    const { data: prog } = await admin.from('user_programme').select('*').eq('user_id', user.id).single();
    if (!prog) return NextResponse.json({ error: 'No programme found' }, { status: 404 });

    const nextWeek = Math.min(prog.current_week + 1, PROGRAMME.length);
    const completed = [...new Set([...prog.completed_weeks, prog.current_week])];

    const { data } = await admin.from('user_programme').update({
      current_week: nextWeek,
      week_started_at: new Date().toISOString(),
      completed_weeks: completed,
    }).eq('user_id', user.id).select().single();

    const weekStart = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { count } = await admin.from('practice_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekStart);
    const state = computeProgrammeState(data.current_week, data.week_started_at, data.completed_weeks, count ?? 0);
    return NextResponse.json(state);
  }

  if (body.action === 'reset') {
    const { data } = await admin.from('user_programme').upsert({
      user_id: user.id, current_week: 1,
      week_started_at: new Date().toISOString(),
      completed_weeks: [], started_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select().single();
    const state = computeProgrammeState(data.current_week, data.week_started_at, data.completed_weeks, 0);
    return NextResponse.json(state);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
