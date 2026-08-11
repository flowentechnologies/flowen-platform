import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronRequest } from '@/lib/cron-auth';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isManual = req.headers.get('x-triggered-by') !== null;
  const started  = Date.now();
  const runId    = crypto.randomUUID();
  const admin    = db();

  let completed = 0;
  let errors    = 0;

  try {
    // Find profiles where erasure was requested but not completed.
    // This catches cases where apply_gdpr_erasure RPC was called but
    // data_erasure_completed_at was never set (e.g. RPC error at sign-out time).
    const { data: pending } = await admin
      .from('profiles')
      .select('id')
      .not('data_erasure_requested_at', 'is', null)
      .is('data_erasure_completed_at', null);

    for (const row of (pending ?? [])) {
      const { error } = await admin.rpc('apply_gdpr_erasure', { target_user_id: row.id });
      if (error) {
        console.error(`[gdpr-sweep] failed for user ${row.id}:`, error.message);
        errors++;
      } else {
        completed++;
      }
    }

    // Also catch users who withdrew consent via the audit log but whose
    // profile still shows data_erasure_completed_at IS NULL.
    const { data: withdrawals } = await admin
      .from('consent_audit_log')
      .select('user_id')
      .eq('event_type', 'gdpr_consent_withdrawn');

    const withdrawn = new Set((withdrawals ?? []).map(r => r.user_id as string));
    if (withdrawn.size > 0) {
      const { data: incomplete } = await admin
        .from('profiles')
        .select('id')
        .in('id', [...withdrawn])
        .is('data_erasure_completed_at', null);

      for (const row of (incomplete ?? [])) {
        const { error } = await admin.rpc('apply_gdpr_erasure', { target_user_id: row.id });
        if (error) {
          console.error(`[gdpr-sweep] consent-log pass failed for ${row.id}:`, error.message);
          errors++;
        } else {
          completed++;
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gdpr-sweep] fatal:', msg);

    if (!isManual) {
      await admin.from('cron_runs').insert({
        id: runId, job_id: 'gdpr-sweep', status: 'error', triggered_by: 'schedule',
        duration_ms: Date.now() - started, result: null, error: msg,
        started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const result = { completed, errors };

  if (!isManual) {
    await admin.from('cron_runs').insert({
      id: runId, job_id: 'gdpr-sweep',
      status: errors > 0 ? 'partial' : 'success',
      triggered_by: 'schedule',
      duration_ms: Date.now() - started,
      result,
      error: null,
      started_at: new Date(started).toISOString(),
      finished_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, ...result });
}


