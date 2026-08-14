import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendSlpInactivityAlerts } from '@/lib/slp-inactivity-alerts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
