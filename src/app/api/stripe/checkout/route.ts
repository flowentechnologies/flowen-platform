import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe';
import { checkCheckoutRateLimit } from '@/lib/rate-limit';

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

  // Authentication is required — an anonymous checkout session cannot be linked
  // to a Flowen user account. The Stripe webhook resolves the user via their email
  // (get_user_id_by_email RPC) or the customers table. Without a known email,
  // checkout.session.completed throws "Cannot resolve user" and the subscription
  // is never activated. Reject unauthenticated requests up-front.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const customerEmail = user.email;

  // Rate limit: 5 attempts per 15 min per IP, 10 per hour per user.
  // Prevents card-testing bots and accidental hammering.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anon';
  const { allowed, reason } = await checkCheckoutRateLimit(ip, user.id);
  if (!allowed) {
    return NextResponse.json({ error: reason ?? 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const session = await client.checkout.sessions.create({
      managed_payments: { enabled: false },
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      // 7-day free trial — card is collected upfront so the trial-to-paid
      // conversion is automatic. Stripe won't charge until day 8.
      subscription_data: { trial_period_days: 7 },
      success_url: `${baseUrl}/dashboard/billing?success=1&trial=1`,
      cancel_url: `${baseUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout error';
    console.error('[checkout] Stripe error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
