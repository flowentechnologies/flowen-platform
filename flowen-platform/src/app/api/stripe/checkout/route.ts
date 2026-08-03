import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

type BillingCycle = 'monthly' | 'quarterly' | 'six_months' | 'yearly';

// Maps each billing cycle to the correct Stripe price_data.
// Amounts in pence (GBP) matching Pricing.tsx display values.
const CYCLE_PRICE: Record<BillingCycle, {
  unit_amount: number;
  interval: 'month' | 'year';
  interval_count: number;
  label: string;
}> = {
  monthly:    { unit_amount: 3596,  interval: 'month', interval_count: 1, label: 'Founding Member — Monthly'    },
  quarterly:  { unit_amount: 8991,  interval: 'month', interval_count: 3, label: 'Founding Member — Quarterly'  },
  six_months: { unit_amount: 14382, interval: 'month', interval_count: 6, label: 'Founding Member — 6 Months'   },
  yearly:     { unit_amount: 23952, interval: 'year',  interval_count: 1, label: 'Founding Member — Annual'     },
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
  const priceConfig = CYCLE_PRICE[cycle] ?? CYCLE_PRICE.yearly;

  // Optionally attach the logged-in user's email so the webhook can resolve their account
  let customerEmail: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) customerEmail = user.email;
  } catch { /* unauthenticated — proceed without email */ }

  try {
    const session = await stripe.checkout.sessions.create({
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: priceConfig.label,
              description: 'Price-locked for your first 12 months. Cancel any time.',
            },
            unit_amount: priceConfig.unit_amount,
            recurring: {
              interval:       priceConfig.interval,
              interval_count: priceConfig.interval_count,
            },
          },
          quantity: 1,
        },
      ],
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
