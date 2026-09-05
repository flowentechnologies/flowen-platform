/**
 * /api/cron/consistency-check
 *
 * Runs the three cross-system consistency checks (billing, marketing,
 * venture — see src/lib/consistency-checks.ts) daily, records the result
 * in consistency_checks, and raises an admin_notifications row (high
 * priority, real-time via the existing Supabase Realtime subscription in
 * NotificationBell) for anything that isn't 'ok'. Nothing here auto-
 * resolves a discrepancy — per the founder's own decision, these always
 * get flagged for a human to look at.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { checkBilling, checkMarketing, checkVenture, type CheckResult } from '@/lib/consistency-checks';

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

  const supabase = db();
  const checks: { type: 'billing' | 'marketing' | 'venture'; result: CheckResult }[] = [
    { type: 'billing', result: await checkBilling() },
    { type: 'marketing', result: await checkMarketing() },
    { type: 'venture', result: await checkVenture() },
  ];

  for (const { type, result } of checks) {
    await supabase.from('consistency_checks').insert({
      check_type: type,
      status: result.status,
      summary: result.summary,
      details: result.details,
    });

    if (result.status !== 'ok') {
      await supabase.from('admin_notifications').insert({
        type: 'system',
        title: `Consistency check: ${type} ${result.status}`,
        body: result.summary,
        link: '/admin/consistency',
        priority: 'high',
      });
    }
  }

  return NextResponse.json({
    checked: checks.map(c => ({ type: c.type, status: c.result.status, summary: c.result.summary })),
  });
}
