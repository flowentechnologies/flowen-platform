import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/guard';

// ── DB client ─────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Known cron job paths ──────────────────────────────────────────────────────

const JOB_PATHS: Record<string, string> = {
  'subscription-sync': '/api/cron/subscription-sync',
  'data-retention':    '/api/cron/data-retention',
  'system-health':     '/api/cron/system-health',
  'gdpr-sweep':        '/api/cron/gdpr-sweep',
  'audit-archive':     '/api/cron/audit-archive',
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; jobId?: string; adminEmail?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  if (action === 'trigger_job') {
    const { jobId, adminEmail } = body;
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    const jobPath = JOB_PATHS[jobId];
    if (!jobPath) return NextResponse.json({ error: `Unknown job: ${jobId}` }, { status: 400 });

    const triggeredBy = `manual:${adminEmail ?? admin.email ?? 'admin'}`;

    // Insert a running record first
    const { data: runRow, error: insertError } = await db()
      .from('cron_runs')
      .insert({ job_id: jobId, status: 'running', triggered_by: triggeredBy })
      .select('id,job_id,status,triggered_by,duration_ms,result,error,started_at,finished_at')
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const runId    = (runRow as { id: string }).id;
    const startedAt = Date.now();

    // Call the job endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:3000`;
    let jobResult: Record<string, unknown> = {};
    let jobError:  string | null = null;
    let jobStatus: 'success' | 'failed' = 'success';

    try {
      const jobRes = await fetch(`${baseUrl}${jobPath}`, {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-cron-secret':   process.env.CRON_SECRET ?? '',
          'x-triggered-by':  triggeredBy,
        },
        body: JSON.stringify({ manual: true }),
      });

      if (jobRes.ok) {
        jobResult = await jobRes.json() as Record<string, unknown>;
      } else {
        jobStatus = 'failed';
        jobError  = `HTTP ${jobRes.status}: ${jobRes.statusText}`;
      }
    } catch (err) {
      jobStatus = 'failed';
      jobError  = err instanceof Error ? err.message : 'Network error';
    }

    const durationMs = Date.now() - startedAt;

    // Update the run record
    const { data: updatedRun } = await db()
      .from('cron_runs')
      .update({
        status:      jobStatus,
        duration_ms: durationMs,
        result:      jobResult,
        error:       jobError,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .select('id,job_id,status,triggered_by,duration_ms,result,error,started_at,finished_at')
      .single();

    return NextResponse.json({ run: updatedRun });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
