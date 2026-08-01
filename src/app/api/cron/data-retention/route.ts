import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret } from '@/lib/cron-auth';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const NINETY_DAYS_MS  = 90  * 86_400_000;
const THIRTY_DAYS_MS  = 30  * 86_400_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req.headers.get('x-cron-secret'))) {
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

  try {
    await Promise.all([
      // Notification delivery log — no user value after 90 days
      purge('notification_log', 'sent_at', cutoff90),
      // Stripe webhook idempotency keys — Stripe only retries within 3 days
      purge('processed_webhook_events', 'processed_at', cutoff90),
      // Cron run history — keep only 30 days of job runs
      purge('cron_runs', 'finished_at', cutoff30),
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
