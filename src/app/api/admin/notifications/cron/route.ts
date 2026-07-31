import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-auth';
import { runChecks } from '../route';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get('x-cron-secret');
  if (!verifyCronSecret(secret)) {
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
