import { NextResponse } from 'next/server';
import { sendPaymentConfirmation, sendWelcomeEmail, sendWaitlistConfirmation } from '@/lib/email';

// Temporary one-shot route — delete after use
export async function POST(req: Request) {
  const { to, template } = await req.json().catch(() => ({ to: null, template: 'welcome' }));

  if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 });

  try {
    switch (template) {
      case 'payment':
        await sendPaymentConfirmation({
          email:       to,
          displayName: 'Howard',
          tier:        'founding',
          cycle:       'yearly',
          amountPence: 23952,
          currency:    'gbp',
        });
        break;

      case 'waitlist':
        await sendWaitlistConfirmation(to);
        break;

      case 'welcome':
      default:
        await sendWelcomeEmail(to, 'Howard');
        break;
    }
    return NextResponse.json({ sent: true, to, template });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
