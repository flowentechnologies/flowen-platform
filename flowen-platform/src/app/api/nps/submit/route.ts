import { NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/supabase/admin';

// POST /api/nps/submit — record score + optional comment from email link or in-app
export async function POST(req: Request) {
  let body: { token: string; score: number; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, score, comment } = body;

  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
  if (typeof score !== 'number' || score < 0 || score > 10) {
    return NextResponse.json({ error: 'score must be 0–10' }, { status: 400 });
  }

  const supabase = db();

  // Look up the pending survey row
  const { data: row, error: fetchErr } = await supabase
    .from('nps_responses')
    .select('id, responded_at')
    .eq('survey_token', token)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  if (row.responded_at) {
    // Already answered — idempotent, just return success
    return NextResponse.json({ ok: true, already: true });
  }

  const { error: updateErr } = await supabase
    .from('nps_responses')
    .update({
      score,
      comment: comment?.trim() || null,
      responded_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (updateErr) {
    console.error('[nps/submit]', updateErr);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
