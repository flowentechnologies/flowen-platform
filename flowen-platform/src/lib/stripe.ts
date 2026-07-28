import Stripe from 'stripe';

const isLive = process.env.NEXT_PUBLIC_STRIPE_ENV === 'live';

export const stripeSecretKey = isLive
  ? process.env.STRIPE_LIVE_SECRET_KEY
  : process.env.STRIPE_TEST_SECRET_KEY;

export const stripeWebhookSecret = isLive
  ? process.env.STRIPE_LIVE_WEBHOOK_SECRET
  : process.env.STRIPE_TEST_WEBHOOK_SECRET;

export const stripePublishableKey = isLive
  ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY
  : process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY;

export const stripe = new Stripe(stripeSecretKey || '', {
  apiVersion: '2025-02-24' as any,
  typescript: true,
});
