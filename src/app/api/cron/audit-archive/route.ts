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

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronSecret(req.headers.get('x-cron-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isManual   = req.headers.get('x-triggered-by') !== null;
  const started    = Date.now();
  const runId      = crypto.randomUUID();
  const durationMs = Date.now() - started;

  if (!isManual) {
    await db().from('cron_runs').insert({
      id:           runId,
      job_id:       'audit-archive',
      status:       'success',
      triggered_by: 'schedule',
      duration_ms:  durationMs,
      result:       { message: 'stub — no-op' },
      error:        null,
      started_at:   new Date(Date.now() - durationMs).toISOString(),
      finished_at:  new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, message: 'stub — no-op' });
}
