import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/admin/audit';
import { UUID, validAnnotations } from '@/lib/asr/dataset';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const actor = await requireAdmin();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin) return NextResponse.json({ error: 'Cross-origin request denied' }, { status: 403 });
  if (Number(req.headers.get('content-length') || 0) > 1000000) return NextResponse.json({ error: 'Annotation too large' }, { status: 413 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (JSON.stringify(body).length > 1000000) return NextResponse.json({ error: 'Annotation too large' }, { status: 413 });
  if (!body || !UUID.test(body.id ?? '') || !['playback', 'annotate'].includes(body.action)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const db = adminDb();
  const { data: sample, error } = await db.from('training_samples').select('id,user_id,storage_path,duration_seconds,consent_version,transcript,disfluency_events').eq('id', body.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Dataset unavailable' }, { status: 503 });
  if (!sample) return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
  const { data: profile, error: consentError } = await db.from('profiles').select('consent_data_collection').eq('id', sample.user_id).maybeSingle();
  if (consentError || !profile?.consent_data_collection || !sample.consent_version) return NextResponse.json({ error: 'Current training consent could not be confirmed' }, { status: 403 });
  if (body.action === 'playback') {
    const { data, error: storageError } = await db.storage.from('training-data').createSignedUrl(sample.storage_path, 60);
    if (storageError || !data) return NextResponse.json({ error: 'Audio unavailable' }, { status: 503 });
    await logAuditEvent({ actor_id: actor.id, action: 'dataset.playback', resource_type: 'training_sample', resource_id: sample.id });
    return NextResponse.json({ url: data.signedUrl, expires_in: 60 }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (typeof body.transcript !== 'string' || body.transcript.length > 20000 ||
      !validAnnotations(body.events, sample.duration_seconds) ||
      typeof body.previous !== 'string' || typeof body.previousEvents !== 'string') return NextResponse.json({ error: 'Invalid transcript or event timestamps' }, { status: 400 });
  if ((sample.transcript ?? '') !== body.previous || JSON.stringify(sample.disfluency_events ?? []) !== body.previousEvents) return NextResponse.json({ error: 'Sample changed. Reload before saving.' }, { status: 409 });
  let update = db.from('training_samples').update({ transcript: body.transcript, disfluency_events: body.events }).eq('id', sample.id);
  update = sample.transcript === null ? update.is('transcript', null) : update.eq('transcript', sample.transcript);
  update = sample.disfluency_events === null ? update.is('disfluency_events', null) : update.eq('disfluency_events', JSON.stringify(sample.disfluency_events));
  const saved = await update.select('id');
  if (saved.error) return NextResponse.json({ error: 'Annotation was not saved' }, { status: 503 });
  if (!saved.data?.length) return NextResponse.json({ error: 'Sample changed. Reload before saving.' }, { status: 409 });
  await logAuditEvent({ actor_id: actor.id, actor_email: actor.email, action: 'dataset.annotate', resource_type: 'training_sample', resource_id: sample.id,
    metadata: { event_count: body.events.length, transcript_length: body.transcript.length } });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
