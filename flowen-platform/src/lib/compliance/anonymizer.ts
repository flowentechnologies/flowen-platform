/**
 * Flowen compliance anonymizer
 *
 * Strips and hashes biometric identity fields before any data reaches
 * persistent storage. All functions are pure (no I/O) so they can be called
 * from both server-side API routes and the WebSocket telemetry ingest pipeline.
 *
 * UK-GDPR / ICO basis:
 *   - Article 9: special-category (biometric) data must be pseudonymised or
 *     anonymised before storage unless explicit consent is active.
 *   - Article 25: data protection by design and by default.
 *   - Recital 26: pseudonymised data is still personal data; anonymised data
 *     (where re-identification is not reasonably possible) is not.
 *
 * Anonymisation approach: HMAC-SHA256 with a per-deployment secret salt
 * (ANONYMIZER_SALT env var). This is deterministic pseudonymisation — the
 * same input always produces the same output within a deployment, enabling
 * cross-session analytics without storing the original identifiers.
 *
 * Acoustic embeddings (vector(512)): stripped entirely unless the user has
 * opted into the telemetry programme. Embeddings could uniquely identify a
 * speaker (voiceprint); they must never reach the DB without explicit consent.
 */

import { createHmac } from 'crypto';

// ── Salt ──────────────────────────────────────────────────────────────────────

function getSalt(): string {
  const salt = process.env.ANONYMIZER_SALT;
  if (!salt || salt.length < 32) {
    throw new Error(
      'ANONYMIZER_SALT must be set and at least 32 characters long. ' +
      'Generate one with: openssl rand -hex 32',
    );
  }
  return salt;
}

// ── Core hash ─────────────────────────────────────────────────────────────────

/**
 * Produce a deterministic, one-way pseudonymised identifier.
 * Output is a 64-character hex string (256-bit HMAC-SHA256).
 */
export function pseudonymise(value: string): string {
  return createHmac('sha256', getSalt())
    .update(value, 'utf8')
    .digest('hex');
}

// ── Telemetry log anonymisation ───────────────────────────────────────────────

export interface RawTelemetryLog {
  id:                string;
  session_id:        string;
  user_id:           string;
  disfluency_type:   string;
  confidence_score:  number;
  audio_clip_r2_path?: string | null;
  acoustic_embedding?: number[] | null;
  created_at:        string;
}

export interface AnonymisedTelemetryLog {
  session_hash:           string;  // pseudonymised session_id
  disfluency_type:        string;
  confidence_score:       number;
  acoustic_embedding:     number[] | null;  // null unless user opted in
  created_at:             string;
  // No user_id, no audio_clip path, no raw session_id
}

/**
 * Strip identity from a raw telemetry log before persistence.
 *
 * @param log            Raw log row from the realtime pipeline
 * @param telemetryOptIn Whether the user has consented to embedding storage
 */
export function anonymiseTelemetryLog(
  log: RawTelemetryLog,
  telemetryOptIn: boolean,
): AnonymisedTelemetryLog {
  return {
    session_hash:       pseudonymise(log.session_id),
    disfluency_type:    log.disfluency_type,
    confidence_score:   log.confidence_score,
    // Acoustic embeddings are voiceprints — strip unless explicitly opted in.
    acoustic_embedding: telemetryOptIn ? (log.acoustic_embedding ?? null) : null,
    created_at:         log.created_at,
  };
}

// ── Session snapshot anonymisation ────────────────────────────────────────────

export interface RawSessionSnapshot {
  session_id:              string;
  user_id:                 string;
  snapshot_at:             string;
  pacer_bpm?:              number | null;
  target_bpm?:             number | null;
  pacer_phase?:            string | null;
  rms_level?:              number | null;
  peak_rms?:               number | null;
  fundamental_freq_hz?:    number | null;
  laryngeal_tension_index?: number | null;
  is_voice_active?:        boolean | null;
  block_detected?:         boolean | null;
  block_duration_ms?:      number | null;
  pipeline_latency_ms?:    number | null;
}

export interface AnonymisedSessionSnapshot {
  session_hash:            string;
  snapshot_at:             string;
  pacer_bpm:               number | null;
  target_bpm:              number | null;
  pacer_phase:             string | null;
  rms_level:               number | null;
  peak_rms:                number | null;
  fundamental_freq_hz:     number | null;
  laryngeal_tension_index: number | null;
  is_voice_active:         boolean | null;
  block_detected:          boolean | null;
  block_duration_ms:       number | null;
  pipeline_latency_ms:     number | null;
}

/**
 * Strip user_id and session_id from a snapshot, replacing with a hash.
 * Biomarker values are retained — they are not directly identifying on their own.
 */
export function anonymiseSnapshot(snap: RawSessionSnapshot): AnonymisedSessionSnapshot {
  return {
    session_hash:            pseudonymise(snap.session_id),
    snapshot_at:             snap.snapshot_at,
    pacer_bpm:               snap.pacer_bpm              ?? null,
    target_bpm:              snap.target_bpm             ?? null,
    pacer_phase:             snap.pacer_phase            ?? null,
    rms_level:               snap.rms_level              ?? null,
    peak_rms:                snap.peak_rms               ?? null,
    fundamental_freq_hz:     snap.fundamental_freq_hz    ?? null,
    laryngeal_tension_index: snap.laryngeal_tension_index ?? null,
    is_voice_active:         snap.is_voice_active        ?? null,
    block_detected:          snap.block_detected         ?? null,
    block_duration_ms:       snap.block_duration_ms      ?? null,
    pipeline_latency_ms:     snap.pipeline_latency_ms    ?? null,
  };
}

// ── Acoustic embedding stripping ──────────────────────────────────────────────

/**
 * Zero out an acoustic embedding vector in-place before any network transit.
 * Call this on the hot telemetry ingest path when the user has not opted in,
 * before the data reaches Kafka or Supabase.
 */
export function stripAcousticEmbedding<T extends { acoustic_embedding?: unknown }>(
  record: T,
): Omit<T, 'acoustic_embedding'> & { acoustic_embedding: null } {
  return { ...record, acoustic_embedding: null };
}

// ── Batch processor ───────────────────────────────────────────────────────────

/**
 * Process a batch of raw telemetry logs, anonymising each one.
 * Used by the Kafka consumer and the Supabase Edge Function ingest handler.
 */
export function anonymiseTelemetryBatch(
  logs: RawTelemetryLog[],
  telemetryOptIn: boolean,
): AnonymisedTelemetryLog[] {
  return logs.map(log => anonymiseTelemetryLog(log, telemetryOptIn));
}

// ── PII field scrubber ────────────────────────────────────────────────────────

const PII_KEYS = new Set([
  'user_id', 'userId', 'email', 'name', 'full_name', 'ip_address',
  'phone', 'address', 'date_of_birth', 'national_insurance',
  'audio_clip_r2_path', 'audioClipPath',
]);

/**
 * Deep-scrub a plain object, replacing known PII fields with a pseudonymised
 * hash or null. Used for sanitising arbitrary event payloads before logging.
 */
export function scrubPii(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEYS.has(key)) {
      result[key] = typeof value === 'string' ? pseudonymise(value) : null;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = scrubPii(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
