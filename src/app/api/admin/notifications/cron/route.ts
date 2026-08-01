import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { runChecks } from '../route';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runChecks();
    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    console.error('[notifications/cron] check error:', err);
    return NextResponse.json(
      { error: 'Check failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
