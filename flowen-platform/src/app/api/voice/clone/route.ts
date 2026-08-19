/**
 * POST /api/voice/clone
 *
 * Receives a voice recording from the calibration step, uploads it to
 * ElevenLabs Instant Voice Clone, and saves the resulting voice_id to the
 * user's profile. Subsequent ConvoAI sessions use this voice_id so the
 * avatar speaks back in the user's own voice.
 *
 * Body: multipart/form-data { audio: File }
 * Response: { voiceId: string; name: string }
 *
 * DELETE /api/voice/clone
 * Deletes the cloned voice from ElevenLabs and clears the profile field.
 * Used for GDPR erasure and re-calibration.
 */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { adminDb } from '@/lib/supabase/admin';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

function getElevenLabsKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not configured');
  return key;
}

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Create / replace voice clone ──────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) return NextResponse.json({ error: 'No audio file' }, { status: 400 });

    const db = adminDb();

    // Check if user already has a cloned voice — delete it first to avoid
    // accumulating unused voices in ElevenLabs (each costs a slot).
    const { data: profile } = await db
      .from('profiles')
      .select('voice_clone_id')
      .eq('id', user.id)
      .single();

    if (profile?.voice_clone_id) {
      try {
        await fetch(`${ELEVENLABS_BASE}/voices/${profile.voice_clone_id}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': getElevenLabsKey() },
        });
      } catch {
        // Non-fatal — proceed even if the old voice is already gone
      }
    }

    // Build multipart form for ElevenLabs
    const el = new FormData();
    el.append('name', `flowen-${user.id.slice(0, 8)}`);
    el.append('description', 'Flowen speech therapy voice clone');
    el.append('files', audioFile, 'calibration.webm');
    // Labels help with GDPR auditing
    el.append('labels', JSON.stringify({ app: 'flowen', user_id: user.id.slice(0, 8) }));

    const elRes = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': getElevenLabsKey() },
      body: el,
    });

    if (!elRes.ok) {
      const err = await elRes.text();
      console.error('[voice/clone] ElevenLabs error:', err);
      return NextResponse.json(
        { error: 'Voice clone failed — check ElevenLabs quota or audio quality' },
        { status: elRes.status },
      );
    }

    const { voice_id } = await elRes.json() as { voice_id: string };

    // Persist to profile
    const { error: dbErr } = await db
      .from('profiles')
      .update({
        voice_clone_id:   voice_id,
        voice_clone_name: `flowen-${user.id.slice(0, 8)}`,
        voice_cloned_at:  new Date().toISOString(),
      })
      .eq('id', user.id);

    if (dbErr) {
      console.error('[voice/clone] db update error:', dbErr.message);
      // Best-effort: voice was created in ElevenLabs — return it even if db write fails
    }

    return NextResponse.json({ voiceId: voice_id, name: `flowen-${user.id.slice(0, 8)}` });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[voice/clone] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Delete voice clone (GDPR / re-calibration) ────────────────────────────────
export async function DELETE(_req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = adminDb();
    const { data: profile } = await db
      .from('profiles')
      .select('voice_clone_id')
      .eq('id', user.id)
      .single();

    if (profile?.voice_clone_id) {
      await fetch(`${ELEVENLABS_BASE}/voices/${profile.voice_clone_id}`, {
        method: 'DELETE',
        headers: { 'xi-api-key': getElevenLabsKey() },
      }).catch(() => {});
    }

    await db
      .from('profiles')
      .update({ voice_clone_id: null, voice_clone_name: null, voice_cloned_at: null })
      .eq('id', user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
