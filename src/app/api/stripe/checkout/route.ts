import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

type BillingCycle = 'monthly' | 'quarterly' | 'six_months' | 'yearly';

// Maps each billing cycle to the pre-created Stripe price ID.
// Price IDs are set as Vercel env vars; amounts are kept here for the fallback
// that fires if an env var is somehow missing at runtime.
const CYCLE_PRICE_ID: Record<BillingCycle, string | undefined> = {
  monthly:    process.env.STRIPE_PRICE_FOUNDING_MONTHLY,
  quarterly:  process.env.STRIPE_PRICE_FOUNDING_QUARTERLY,
  six_months: process.env.STRIPE_PRICE_FOUNDING_SIX_MONTHS,
  yearly:     process.env.STRIPE_PRICE_FOUNDING_YEARLY,
};

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowen.digital';

export async function POST(req: Request) {
  let body: { interval?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const cycle = (body.interval ?? 'yearly') as BillingCycle;
  const priceId = CYCLE_PRICE_ID[cycle] ?? CYCLE_PRICE_ID.yearly;

  if (!priceId) {
    console.error(`[checkout] No price ID configured for cycle: ${cycle}`);
    return NextResponse.json({ error: 'Pricing not configured' }, { status: 500 });
  }

  // Optionally attach the logged-in user's email so the webhook can resolve their account
  let customerEmail: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) customerEmail = user.email;
  } catch { /* unauthenticated — proceed without email */ }

  try {
    const session = await stripe.checkout.sessions.create({
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
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
