import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Flowen Founding Member (50% Off)',
              description: 'Locked in for your first 12 months. Billed annually.',
            },
            unit_amount: 5988,
            recurring: {
              interval: 'year',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowen.digital'}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.flowen.digital'}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout error';
    console.error('Stripe Checkout Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
