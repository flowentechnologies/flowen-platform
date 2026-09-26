/**
 * Deletes the raw-audio artifacts a user's account can accumulate — session
 * recordings and an ElevenLabs voice clone — that the `apply_gdpr_erasure`
 * Postgres RPC cannot touch itself (it has no way to call an external HTTP
 * API, so it only ever updated/deleted plain rows: profiles, telemetry_logs,
 * session_snapshots).
 *
 * The ROPA (src/app/admin/ropa/page.tsx) already documented session
 * recordings as "deleted on account erasure" and the voice-clone DELETE
 * route's own docstring already claimed to be "used for GDPR erasure" —
 * neither was actually true until this was wired in. Call this alongside
 * every real call site of apply_gdpr_erasure (currently
 * src/app/api/admin/tickets/gdpr/route.ts and src/app/api/cron/gdpr-sweep/
 * route.ts), before the auth user is deleted.
 *
 * Best-effort throughout, like every other erasure step in this codebase —
 * a single already-gone storage object shouldn't block the rest of erasure.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isR2Configured, deleteFromR2 } from '@/lib/r2';

const RECORDINGS_BUCKET = 'session-recordings';
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export interface AudioErasureResult {
  sessionRecordingsDeleted: number;
  voiceCloneDeleted: boolean;
  errors: string[];
}

export async function eraseUserAudioArtifacts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  userId: string,
): Promise<AudioErasureResult> {
  const errors: string[] = [];
  let sessionRecordingsDeleted = 0;

  const { data: sessions, error: selectErr } = await admin
    .from('practice_sessions')
    .select('id, audio_storage_path, audio_storage_provider')
    .eq('user_id', userId)
    .not('audio_storage_path', 'is', null);

  if (selectErr) {
    errors.push(`session_recordings select: ${selectErr.message}`);
  } else {
    for (const row of sessions ?? []) {
      const path = row.audio_storage_path as string;
      try {
        if (row.audio_storage_provider === 'r2' && isR2Configured()) {
          await deleteFromR2(path);
        } else {
          const { error: removeErr } = await admin.storage.from(RECORDINGS_BUCKET).remove([path]);
          if (removeErr) throw new Error(removeErr.message);
        }
      } catch (err) {
        errors.push(`session_recording ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }

      const { error: updateErr } = await admin
        .from('practice_sessions')
        .update({ audio_storage_path: null, audio_storage_provider: null })
        .eq('id', row.id);
      if (updateErr) {
        errors.push(`session_recording ${row.id} clear-path: ${updateErr.message}`);
        continue;
      }
      sessionRecordingsDeleted++;
    }
  }

  let voiceCloneDeleted = false;
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('voice_clone_id')
    .eq('id', userId)
    .single();

  if (profileErr) {
    errors.push(`profile select: ${profileErr.message}`);
  } else if (profile?.voice_clone_id) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      errors.push('voice_clone: ELEVENLABS_API_KEY not configured — clone left in place');
    } else {
      try {
        await fetch(`${ELEVENLABS_BASE}/voices/${profile.voice_clone_id}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': apiKey },
        });
      } catch (err) {
        errors.push(`voice_clone delete: ${err instanceof Error ? err.message : String(err)}`);
      }

      const { error: clearErr } = await admin
        .from('profiles')
        .update({ voice_clone_id: null, voice_clone_name: null, voice_cloned_at: null })
        .eq('id', userId);
      if (clearErr) {
        errors.push(`voice_clone clear-field: ${clearErr.message}`);
      } else {
        voiceCloneDeleted = true;
      }
    }
  }

  return { sessionRecordingsDeleted, voiceCloneDeleted, errors };
}
