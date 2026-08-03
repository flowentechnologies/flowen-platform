import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const results: Record<string, unknown> = {};

  try {
    // Create a single product for all founding-member plans
    const product = await stripe.products.create({
      name: 'Flowen — Founding Member',
      description: 'Founding Member subscription — price-locked for your first 12 months. Cancel any time.',
    });
    results.product = { id: product.id, name: product.name };

    // Create all 4 prices against that product
    const [monthly, quarterly, sixMonths, yearly] = await Promise.all([
      stripe.prices.create({
        product: product.id,
        currency: 'gbp',
        unit_amount: 3596,
        recurring: { interval: 'month', interval_count: 1 },
        nickname: 'Founding Member — Monthly',
      }),
      stripe.prices.create({
        product: product.id,
        currency: 'gbp',
        unit_amount: 8991,
        recurring: { interval: 'month', interval_count: 3 },
        nickname: 'Founding Member — Quarterly',
      }),
      stripe.prices.create({
        product: product.id,
        currency: 'gbp',
        unit_amount: 14382,
        recurring: { interval: 'month', interval_count: 6 },
        nickname: 'Founding Member — 6 Months',
      }),
      stripe.prices.create({
        product: product.id,
        currency: 'gbp',
        unit_amount: 23952,
        recurring: { interval: 'year', interval_count: 1 },
        nickname: 'Founding Member — Annual',
      }),
    ]);

    results.prices = {
      STRIPE_PRICE_FOUNDING_MONTHLY:    monthly.id,
      STRIPE_PRICE_FOUNDING_QUARTERLY:  quarterly.id,
      STRIPE_PRICE_FOUNDING_SIX_MONTHS: sixMonths.id,
      STRIPE_PRICE_FOUNDING_YEARLY:     yearly.id,
    };
  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(results);
}
