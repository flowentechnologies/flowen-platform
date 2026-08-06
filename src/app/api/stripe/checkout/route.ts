import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe';

type BillingCycle = 'monthly' | 'quarterly' | 'six_months' | 'yearly';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowen.digital';

export async function POST(req: Request) {
  let body: { interval?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const cycle = (body.interval ?? 'yearly') as BillingCycle;

  // Resolve mode, client, and price IDs at request time from app_config.
  const { client, mode, priceIds } = await getStripeClient();

  const CYCLE_PRICE_ID: Record<BillingCycle, string | undefined> = {
    monthly:    priceIds.monthly,
    quarterly:  priceIds.quarterly,
    six_months: priceIds.six_months,
    yearly:     priceIds.yearly,
  };

  const priceId = CYCLE_PRICE_ID[cycle] ?? CYCLE_PRICE_ID.yearly;

  if (!priceId) {
    console.error(`[checkout] No ${mode} price ID configured for cycle: ${cycle}`);
    return NextResponse.json(
      { error: `Pricing not configured for ${mode} mode — ${cycle}` },
      { status: 500 },
    );
  }

  // Attach the logged-in user's email so the webhook can resolve their account.
  let customerEmail: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) customerEmail = user.email;
  } catch { /* unauthenticated — proceed without email */ }

  try {
    const session = await client.checkout.sessions.create({
      managed_payments: { enabled: false },
      payment_method_types: ['card'],
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: customerEmail
        ? `${baseUrl}/dashboard/billing?success=1`
        : `${baseUrl}/?success=true`,
      cancel_url: `${baseUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout error';
    console.error('[checkout] Stripe error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
