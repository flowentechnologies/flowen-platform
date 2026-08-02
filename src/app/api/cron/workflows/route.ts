import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { runScheduleWorkflows, advancePendingRuns } from '@/lib/workflow-executor';

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [schedule, pending] = await Promise.all([
      runScheduleWorkflows(),
      advancePendingRuns(),
    ]);

    return NextResponse.json({
      ok: true,
      schedule: { workflows_run: schedule.total, actions_sent: schedule.count },
      pending: { advanced: pending.advanced, errors: pending.errors },
    });
  } catch (err) {
    console.error('[cron/workflows] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
