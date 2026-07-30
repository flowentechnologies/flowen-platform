import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const started    = Date.now();
  const runId      = crypto.randomUUID();
  const durationMs = Date.now() - started;

  // Stub — actual GDPR overdue-request flagging is future work.
  await db().from('cron_runs').insert({
    id:           runId,
    job_id:       'gdpr-sweep',
    status:       'success',
    triggered_by: 'schedule',
    duration_ms:  durationMs,
    result:       { message: 'stub — no-op' },
    error:        null,
    started_at:   new Date(Date.now() - durationMs).toISOString(),
    finished_at:  new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, message: 'stub — no-op' });
}
