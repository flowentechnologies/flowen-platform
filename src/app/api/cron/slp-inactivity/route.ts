import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendSlpInactivityAlerts } from '@/lib/slp-inactivity-alerts';
import { withCronLogging } from '@/lib/cron-logging';

export const dynamic = 'force-dynamic';

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendSlpInactivityAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/slp-inactivity]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export const GET = withCronLogging('slp-inactivity', handle);
