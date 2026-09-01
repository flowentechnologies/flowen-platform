import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { sendTrialEmails } from '@/lib/trial-emails';

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await sendTrialEmails();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[trial-emails/cron] error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
