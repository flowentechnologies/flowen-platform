// ── Recording storage categorization ────────────────────────────────────────────
// Pure key/metadata builders for practice session audio recordings in R2,
// kept separate from src/lib/r2.ts (the generic R2 client) so this
// session-specific categorization logic is unit-testable without touching
// the S3 SDK.
//
// Key layout: {brand}/stage-{stageId}/{yyyy-mm}/{userId}/{sessionId}.webm
// Chosen so an admin browsing the R2 console — or a training pipeline doing
// a prefix-scoped ListObjectsV2 — can navigate straight to "all Flowen
// stage-3 recordings from March" without touching the database. The
// database (practice_sessions) stays the source of truth for querying and
// the admin UI; this hierarchy is for humans and external tools reading R2
// directly. Only applies to new R2 uploads — existing Supabase Storage
// paths stay flat (`${userId}/${sessionId}.webm`) and are read verbatim
// from audio_storage_path regardless of shape.
//
// CONSENT BOUNDARY — read before touching this: the session-recordings
// bucket captures audio unconditionally, with no ML-consent gate (see
// recording/route.ts's own comment). Labeling it well for admin browsing
// does NOT make it fair game for model training. Only the separately
// consent-gated training-data bucket
// (src/app/api/practice/sessions/[id]/audio/route.ts, gated on
// profiles.consent_data_collection) may be used that way. Never merge these
// two pipelines or point a training job at session-recordings.

export interface RecordingCategory {
  userId: string;
  sessionId: string;
  brand: string | null;
  stageId: number | null;
  createdAt: string | Date | null;
}

function safeSegment(value: string | number | null | undefined, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function yearMonth(createdAt: string | Date | null): string {
  const d = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(d.getTime())) return 'unknown-date';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

export function buildRecordingR2Key(cat: RecordingCategory): string {
  const brand = safeSegment(cat.brand, 'unbranded');
  const stage = cat.stageId != null ? `stage-${cat.stageId}` : 'stage-unknown';
  const period = yearMonth(cat.createdAt);
  return `${brand}/${stage}/${period}/${cat.userId}/${cat.sessionId}.webm`;
}

export interface RecordingMetadata extends RecordingCategory {
  durationSeconds?: number | null;
  blocksDetected?: number | null;
  repetitionsDetected?: number | null;
  prolongationsDetected?: number | null;
}

/** R2/S3 object metadata values must be strings, and every key becomes an
 *  x-amz-meta-* header — every field here is stringified, and null/
 *  undefined fields are omitted rather than written as the literal
 *  string "null". */
export function buildRecordingR2Metadata(m: RecordingMetadata): Record<string, string> {
  const out: Record<string, string> = {
    'session-id': m.sessionId,
    'user-id': m.userId,
  };
  if (m.brand) out['brand'] = m.brand;
  if (m.stageId != null) out['stage-id'] = String(m.stageId);
  if (m.durationSeconds != null) out['duration-seconds'] = String(m.durationSeconds);
  if (m.blocksDetected != null) out['blocks-detected'] = String(m.blocksDetected);
  if (m.repetitionsDetected != null) out['repetitions-detected'] = String(m.repetitionsDetected);
  if (m.prolongationsDetected != null) out['prolongations-detected'] = String(m.prolongationsDetected);
  return out;
}
