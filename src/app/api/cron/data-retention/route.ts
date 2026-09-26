import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { isR2Configured, deleteFromR2 } from '@/lib/r2';

const NINETY_DAYS_MS  = 90  * 86_400_000;
const THIRTY_DAYS_MS  = 30  * 86_400_000;
const RECORDINGS_BUCKET = 'session-recordings';
// Cap per run — this cron runs daily, so a backlog clears within days
// without one run trying to delete an unbounded number of storage objects.
const RECORDINGS_BATCH_LIMIT = 200;
const DEFAULT_SESSION_RETENTION_DAYS = 90;

// Vercel Cron always invokes via GET (with Authorization: Bearer CRON_SECRET);
// /admin/cron's manual trigger uses POST (with x-cron-secret) — verifyCronRequest
// accepts either, so both methods need to route to the same handler.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isManual = req.headers.get('x-triggered-by') !== null;
  const started  = Date.now();
  const runId    = crypto.randomUUID();
  const admin    = db();
  const now      = Date.now();

  const cutoff90  = new Date(now - NINETY_DAYS_MS).toISOString();
  const cutoff30  = new Date(now - THIRTY_DAYS_MS).toISOString();

  type DeleteResult = { count: number; error: string | null };
  const results: Record<string, DeleteResult> = {};

  async function purge(table: string, col: string, cutoff: string): Promise<void> {
    const { error, count } = await admin
      .from(table)
      .delete({ count: 'exact' })
      .lt(col, cutoff);
    results[table] = { count: count ?? 0, error: error?.message ?? null };
    if (error) console.error(`[data-retention] ${table} error:`, error.message);
  }

  // Session-recording audio (special-category health data — see
  // src/app/legal/policies.ts section 2): deletes the storage object once
  // that user's configured retention window has passed, and clears
  // practice_sessions.audio_storage_path/_provider — but deliberately
  // leaves the practice_sessions ROW itself untouched: the fluency metrics,
  // disfluency counts, and clinical progression data on that row are the
  // actual clinical record and are retained under the normal clinical-
  // record rules, independent of the raw audio's lifecycle.
  //
  // Per-user window comes from data_retention_policies.session_retention_days
  // (a column that already existed — auto-created per profile by the
  // on_profile_created_set_retention trigger — but was never actually read
  // anywhere until now). Default is 90 days, matching what the ROPA
  // (src/app/admin/ropa/page.tsx) already documented as happening, chosen
  // to cover an SLP reviewing recent progress without keeping raw
  // biometric audio indefinitely (storage limitation, UK GDPR Article
  // 5(1)(e)) — not a NHS statutory retention period, since this is about
  // disposing of a working artifact, not the clinical record.
  async function purgeSessionRecordings(): Promise<void> {
    // Oldest first, generous cap — filtering against each user's own
    // window happens in JS below since it varies per user.
    const { data: rows, error: selectErr } = await admin
      .from('practice_sessions')
      .select('id, user_id, audio_storage_path, audio_storage_provider, created_at')
      .not('audio_storage_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(RECORDINGS_BATCH_LIMIT);

    if (selectErr) {
      results['session_recordings'] = { count: 0, error: selectErr.message };
      console.error('[data-retention] session_recordings select error:', selectErr.message);
      return;
    }

    const userIds = [...new Set((rows ?? []).map(r => r.user_id as string))];
    const retentionDaysByUser = new Map<string, number>();
    if (userIds.length > 0) {
      const { data: policies, error: policyErr } = await admin
        .from('data_retention_policies')
        .select('user_id, session_retention_days')
        .in('user_id', userIds);
      if (policyErr) {
        results['session_recordings'] = { count: 0, error: `policy lookup: ${policyErr.message}` };
        console.error('[data-retention] session_recordings policy lookup error:', policyErr.message);
        return;
      }
      for (const p of policies ?? []) {
        retentionDaysByUser.set(p.user_id as string, p.session_retention_days as number);
      }
    }

    let deleted = 0;
    let lastError: string | null = null;

    for (const row of rows ?? []) {
      const retentionDays = retentionDaysByUser.get(row.user_id as string) ?? DEFAULT_SESSION_RETENTION_DAYS;
      const cutoff = now - retentionDays * 86_400_000;
      if (new Date(row.created_at as string).getTime() >= cutoff) continue; // not old enough for this user yet

      const path = row.audio_storage_path as string;
      try {
        if (row.audio_storage_provider === 'r2' && isR2Configured()) {
          await deleteFromR2(path);
        } else {
          const { error: removeErr } = await admin.storage.from(RECORDINGS_BUCKET).remove([path]);
          if (removeErr) throw new Error(removeErr.message);
        }
      } catch (err) {
        // Best-effort per-row — an object already gone (e.g. a retry after
        // a partial prior run) shouldn't block clearing the DB pointer or
        // block the rest of the batch.
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[data-retention] session_recordings delete failed for ${row.id}:`, lastError);
      }

      const { error: updateErr } = await admin
        .from('practice_sessions')
        .update({ audio_storage_path: null, audio_storage_provider: null })
        .eq('id', row.id);
      if (updateErr) {
        lastError = updateErr.message;
        console.error(`[data-retention] session_recordings clear-path failed for ${row.id}:`, updateErr.message);
        continue;
      }
      deleted++;
    }

    results['session_recordings'] = { count: deleted, error: lastError };
  }

  try {
    await Promise.all([
      // Notification delivery log — no user value after 90 days
      purge('notification_log', 'sent_at', cutoff90),
      // Stripe webhook idempotency keys — Stripe only retries within 3 days
      purge('processed_webhook_events', 'processed_at', cutoff90),
      // Cron run history — keep only 30 days of job runs
      purge('cron_runs', 'finished_at', cutoff30),
      // Raw session-recording audio — see purgeSessionRecordings above
      purgeSessionRecordings(),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[data-retention] fatal:', msg);

    if (!isManual) {
      await admin.from('cron_runs').insert({
        id: runId, job_id: 'data-retention', status: 'error', triggered_by: 'schedule',
        duration_ms: Date.now() - started, result: null, error: msg,
        started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const hasErrors = Object.values(results).some(r => r.error);

  if (!isManual) {
    await admin.from('cron_runs').insert({
      id: runId, job_id: 'data-retention',
      status: hasErrors ? 'partial' : 'success',
      triggered_by: 'schedule',
      duration_ms: Date.now() - started,
      result: results,
      error: null,
      started_at: new Date(started).toISOString(),
      finished_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, results });
}


