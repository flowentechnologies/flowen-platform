import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendPracticeReminders } from '@/lib/practice-reminders';
import { withCronLogging } from '@/lib/cron-logging';

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await sendPracticeReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[practice-reminders/cron] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const GET = withCronLogging('practice-reminders', handle);
