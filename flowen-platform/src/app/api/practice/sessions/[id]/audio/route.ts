/**
 * POST /api/practice/sessions/:id/audio
 *
 * Receives the practice session audio blob, uploads it to Supabase Storage
 * under training-data/{userId}/{sessionId}.webm, and inserts a training_samples
 * row. Only runs when the user has consent_data_collection = true.
 *
 * Body: multipart/form-data
 *   audio      File    — webm/opus recording from MediaRecorder
 *   duration   number  — seconds
 *   transcript string? — final transcript text
 *   disfluency string? — JSON array of { type, ts_ms, duration_ms }
 *   stage_id   number? — programme stage
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';

const CONSENT_VERSION = '2026-08-01';
const BUCKET          = 'training-data';
// Cap upload at 50 MB — a 60-min session at opus 24kbps would be ~10 MB
const MAX_BYTES       = 50 * 1024 * 1024;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext) {
  const { id: sessionId } = await ctx.params;

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check consent
  const admin = adminDb();
  const { data: profile } = await admin
    .from('profiles')
    .select('consent_data_collection')
    .eq('id', user.id)
    .single();

  if (!profile?.consent_data_collection) {
    return NextResponse.json({ error: 'Data collection consent not given' }, { status: 403 });
  }

  // Verify session belongs to user
  const { data: session } = await admin
    .from('practice_sessions')
    .select('id, duration_seconds, stage_id, transcript')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Idempotency — if already uploaded, return success without re-uploading
  const { data: existing } = await admin
    .from('training_samples')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, sampleId: existing.id, existed: true });
  }

  // Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const audioFile = formData.get('audio') as File | null;
  if (!audioFile) return NextResponse.json({ error: 'No audio file' }, { status: 400 });
  if (audioFile.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio file too large (max 50 MB)' }, { status: 413 });
  }

  const duration    = Number(formData.get('duration') ?? session.duration_seconds ?? 0);
  const transcript  = (formData.get('transcript') as string | null) ?? session.transcript ?? null;
  const disfluency  = (() => {
    const raw = formData.get('disfluency') as string | null;
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  })();
  const stageId     = Number(formData.get('stage_id') ?? session.stage_id ?? 0) || null;

  // Upload to storage
  const storagePath = `${user.id}/${sessionId}.webm`;
  const audioBuffer = await audioFile.arrayBuffer();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, audioBuffer, {
      contentType: audioFile.type || 'audio/webm',
      upsert: false,
    });

  if (uploadErr) {
    console.error('[audio/upload] storage error:', uploadErr.message);
    return NextResponse.json({ error: 'Upload failed: ' + uploadErr.message }, { status: 500 });
  }

  // Insert training_samples row
  const { data: sample, error: dbErr } = await admin
    .from('training_samples')
    .insert({
      session_id:       sessionId,
      user_id:          user.id,
      storage_path:     storagePath,
      format:           audioFile.type || 'audio/webm',
      duration_seconds: duration || null,
      transcript:       typeof transcript === 'string' ? transcript.slice(0, 20_000) : null,
      disfluency_events: disfluency,
      stage_id:         stageId,
      consent_version:  CONSENT_VERSION,
    })
    .select('id')
    .single();

  if (dbErr) {
    console.error('[audio/upload] db error:', dbErr.message);
    // Best-effort — storage upload succeeded, log and continue
  }

  return NextResponse.json({ ok: true, sampleId: sample?.id ?? null });
}
