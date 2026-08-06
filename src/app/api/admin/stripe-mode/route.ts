import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { getStripeMode, setStripeMode, type StripeMode } from '@/lib/stripe-mode';

export async function GET() {
  await assertAdmin();
  const mode = await getStripeMode();
  return NextResponse.json({ mode });
}

export async function POST(req: NextRequest) {
  await assertAdmin();

  const body = await req.json().catch(() => null);
  const mode = body?.mode as StripeMode | undefined;

  if (mode !== 'live' && mode !== 'test') {
    return NextResponse.json({ error: 'mode must be "live" or "test"' }, { status: 400 });
  }

  await setStripeMode(mode);
  return NextResponse.json({ mode });
}
