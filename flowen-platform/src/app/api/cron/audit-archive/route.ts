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

const SIXTY_DAYS_MS = 60 * 86_400_000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isManual = req.headers.get('x-triggered-by') !== null;
  const started  = Date.now();
  const runId    = crypto.randomUUID();
  const admin    = db();

  let ticketsAutoResolved = 0;
  let errors = 0;

  try {
    // Auto-resolve support tickets that have been open for >60 days with
    // no first response — these are stale and unlikely to be actioned.
    const staleAt = new Date(Date.now() - SIXTY_DAYS_MS).toISOString();
    const { error, count } = await admin
      .from('support_tickets')
      .update({
        status:      'resolved',
        resolved_at: new Date().toISOString(),
        internal_notes: 'Auto-resolved by audit-archive cron: open >60 days with no response.',
      }, { count: 'exact' })
      .eq('status', 'open')
      .is('first_response_at', null)
      .lt('created_at', staleAt);

    if (error) {
      console.error('[audit-archive] ticket auto-resolve error:', error.message);
      errors++;
    } else {
      ticketsAutoResolved = count ?? 0;
    }

    // Note: consent_audit_log is retained indefinitely for UK GDPR compliance.
    // No archiving or deletion applies.
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[audit-archive] fatal:', msg);

    if (!isManual) {
      await admin.from('cron_runs').insert({
        id: runId, job_id: 'audit-archive', status: 'error', triggered_by: 'schedule',
        duration_ms: Date.now() - started, result: null, error: msg,
        started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const result = { tickets_auto_resolved: ticketsAutoResolved, errors };

  if (!isManual) {
    await admin.from('cron_runs').insert({
      id: runId, job_id: 'audit-archive',
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

export { POST as GET };
