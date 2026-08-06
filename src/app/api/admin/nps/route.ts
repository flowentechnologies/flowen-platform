import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { sendNpsSurvey } from '@/lib/email';
import { randomUUID } from 'crypto';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// GET — list all NPS responses + summary stats
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: rows, error } = await db()
    .from('nps_responses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const responded = (rows ?? []).filter(r => r.score !== null);
  const total     = responded.length;
  const promoters  = responded.filter(r => r.score >= 9).length;
  const detractors = responded.filter(r => r.score <= 6).length;
  const npsScore   = total > 0
    ? Math.round(((promoters - detractors) / total) * 100)
    : null;
  const avgScore   = total > 0
    ? Math.round((responded.reduce((s, r) => s + r.score, 0) / total) * 10) / 10
    : null;

  const dist = Array.from({ length: 11 }, (_, i) => ({
    score: i,
    count: responded.filter(r => r.score === i).length,
  }));

  return NextResponse.json({
    responses: rows ?? [],
    stats: { total, promoters, detractors, passives: total - promoters - detractors, npsScore, avgScore, dist },
  });
}

// POST — send NPS survey to a specific user
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { email: string; displayName: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, displayName, userId } = body;
  if (!email || !displayName) {
    return NextResponse.json({ error: 'email and displayName required' }, { status: 400 });
  }

  const token = randomUUID();

  const { error: insertErr } = await db().from('nps_responses').insert({
    email,
    user_id:      userId ?? null,
    survey_token: token,
    source:       'email',
    sent_at:      new Date().toISOString(),
  });

  if (insertErr) {
    console.error('[admin/nps POST]', insertErr);
    return NextResponse.json({ error: 'Failed to create survey record' }, { status: 500 });
  }

  await sendNpsSurvey({ email, displayName, token });

  return NextResponse.json({ ok: true, token });
}
