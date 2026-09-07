/**
 * withCronLogging — records a real cron_runs row for a genuinely scheduled
 * invocation, for the routes that never wrote one.
 *
 * Found during an architecture-wide gap audit: only 5 of ~20 scheduled jobs
 * (subscription-sync, gdpr-sweep, data-retention, audit-archive,
 * system-health) actually self-logged their real automatic runs into
 * cron_runs — the table /admin/cron's dashboard reads from. A handful more
 * (gmail-sync, consistency-check, both marketing syncs) only ever got a
 * cron_runs row when someone manually clicked "Run Now" in the admin UI
 * (that click goes through /api/admin/cron, which manages its own record
 * around the call) — meaning nobody could actually tell whether their real
 * *scheduled* runs were succeeding or failing. The rest had no record at
 * all, ever.
 *
 * Rather than hand-editing each route's own internal early-return branches
 * (many have several), this wraps the whole handler at the GET/POST
 * boundary: it times the call, inspects the resulting response to decide
 * success/failure, and writes one row — without touching any route's
 * internal logic.
 *
 * Only logs a request actually authenticated via the shared cron secret
 * (verifyCronRequest) — that covers both Vercel's real schedule and a
 * manual curl/wrapper call using the secret — AND only when it wasn't
 * routed through /api/admin/cron's manual-trigger wrapper (signalled by
 * the x-triggered-by header that wrapper sets, which manages its own
 * separate record around the call). This distinction matters: at least
 * two of these routes (both marketing syncs) ALSO accept a plain admin
 * browser session as a second, independent auth path — e.g. the "Sync
 * now" button in /admin/marketing calls them directly, with neither a
 * cron secret nor x-triggered-by. Gating on x-triggered-by alone would
 * have mislabeled that click as a "scheduled" run in the very table this
 * is trying to make trustworthy.
 *
 * Do NOT wrap the 5 routes above — they already insert their own, more
 * detailed cron_runs row directly (with a per-check/per-service result
 * breakdown a generic wrapper can't reconstruct from the HTTP response
 * alone) and skip doing so themselves specifically when x-triggered-by is
 * present, for the same reason.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/supabase/admin';
import { verifyCronRequest } from '@/lib/cron-auth';

export function withCronLogging(
  jobId: string,
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    const shouldLog = verifyCronRequest(req.headers) && req.headers.get('x-triggered-by') === null;
    const startedAt = Date.now();

    let res: NextResponse;
    let thrownMessage: string | null = null;
    try {
      res = await handler(req);
    } catch (err) {
      thrownMessage = err instanceof Error ? err.message : String(err);
      res = NextResponse.json({ error: thrownMessage }, { status: 500 });
    }

    if (shouldLog) {
      const durationMs = Date.now() - startedAt;
      let body: unknown = null;
      try {
        body = await res.clone().json();
      } catch {
        // Non-JSON or empty body — fine, `result` just stays null.
      }
      const bodyError = body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error) : null;
      const ok = thrownMessage === null && res.status >= 200 && res.status < 300 && !bodyError;
      const finishedAt = new Date();

      const { error: insertError } = await db().from('cron_runs').insert({
        job_id:       jobId,
        status:       ok ? 'success' : 'failed',
        triggered_by: 'schedule',
        duration_ms:  durationMs,
        result:       body,
        error:        thrownMessage ?? bodyError,
        started_at:   new Date(finishedAt.getTime() - durationMs).toISOString(),
        finished_at:  finishedAt.toISOString(),
      });
      // Never let logging itself break the actual cron job — worst case,
      // this one run is silently missing from the dashboard, which is
      // exactly the status quo this is improving on, not a regression.
      if (insertError) console.error(`[cron-logging] failed to record run for ${jobId}:`, insertError.message);
    }

    return res;
  };
}
