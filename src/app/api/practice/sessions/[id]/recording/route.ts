/**
 * /api/practice/sessions/:id/recording
 *
 * POST — receives audio blob, stores in session-recordings bucket,
 *         updates practice_sessions.audio_storage_path.
 *         Always fires after session save (no ML-consent gate).
 *
 * GET  — returns a 1-hour signed URL for the recording.
 *         Accessible by: the patient themselves, or their assigned SLP.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';

const BUCKET   = 'session-recordings';
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const URL_TTL  = 3600;             // 1 hour signed URL

interface Ctx { params: Promise<{ id: string }> }

// ── POST: upload ──────────────────────────────────────────────────────────────

export async function POST(req: Request, ctx: Ctx) {
  const { id: sessionId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = adminDb();

  // Verify session belongs to this user
  const { data: session } = await admin
    .from('practice_sessions')
    .select('id, audio_storage_path')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Idempotency — already uploaded
  if (session.audio_storage_path) {
    return NextResponse.json({ ok: true, existed: true });
  }

  // Parse multipart
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const audioFile = formData.get('audio') as File | null;
  if (!audioFile) return NextResponse.json({ error: 'No audio file' }, { status: 400 });
  if (audioFile.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
  }

  const storagePath = `${user.id}/${sessionId}.webm`;
  const buffer = await audioFile.arrayBuffer();
  // MediaRecorder reports the full type string (e.g. "audio/webm;codecs=opus"),
  // but the bucket's allowed_mime_types allowlist matches on the bare type
  // exactly — the ;codecs=... parameter must be stripped or every real
  // browser-recorded upload is rejected (confirmed happening in production).
  const contentType = (audioFile.type || 'audio/webm').split(';')[0].trim();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadErr) {
    console.error('[recording/upload]', uploadErr.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // Persist path
  await admin
    .from('practice_sessions')
    .update({ audio_storage_path: storagePath })
    .eq('id', sessionId)
    .eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}

// ── GET: signed URL ───────────────────────────────────────────────────────────

export async function GET(_req: Request, ctx: Ctx) {
  const { id: sessionId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = adminDb();

  // Fetch session with ownership + audio path
  const { data: session } = await admin
    .from('practice_sessions')
    .select('user_id, audio_storage_path')
    .eq('id', sessionId)
    .single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!session.audio_storage_path) {
    return NextResponse.json({ error: 'No recording available' }, { status: 404 });
  }

  // Access gate: patient themselves OR their assigned SLP
  const isOwner = session.user_id === user.id;
  if (!isOwner) {
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'clinician') {
      const { data: assignment } = await admin
        .from('slp_assignments')
        .select('id')
        .eq('slp_user_id', user.id)
        .eq('patient_user_id', session.user_id)
        .maybeSingle();
      if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(session.audio_storage_path, URL_TTL);

  if (error || !data?.signedUrl) {
    console.error('[recording/signed-url]', error?.message);
    return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: URL_TTL });
}
