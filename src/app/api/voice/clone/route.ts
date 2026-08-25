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
      const errText = await elRes.text();
      console.error('[voice/clone] ElevenLabs error:', errText);

      // Parse structured ElevenLabs error to give actionable UI message.
      let userMessage = 'Voice cloning failed — please try again or re-record.';
      let statusCode  = elRes.status;
      try {
        const errJson = JSON.parse(errText) as {
          detail?: { code?: string; type?: string; message?: string };
        };
        const code = errJson.detail?.code ?? errJson.detail?.type ?? '';
        if (code === 'paid_plan_required' || code === 'can_not_use_instant_voice_cloning') {
          // Platform-level limitation — don't surface as a user error.
          userMessage = 'Voice personalisation is not available on your current plan. Your session will use a default voice.';
          statusCode  = 402;
        } else if (code === 'quota_exceeded' || code === 'max_voice_add_reached') {
          userMessage = 'Voice library is full. Please contact support to clear old voices.';
          statusCode  = 429;
        } else if (errJson.detail?.message) {
          // Use ElevenLabs message as-is when it's safe to show (not a plan error).
          userMessage = errJson.detail.message;
        }
      } catch {
        // Non-JSON response — keep the default message.
      }

      return NextResponse.json({ error: userMessage }, { status: statusCode });
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
