import Stripe from 'stripe';
import { getStripeMode, type StripeMode } from './stripe-mode';

const API_VERSION = '2026-07-29.dahlia' as const;

// ── Static exports (backward-compat) ─────────────────────────────────────────
//
// These read NEXT_PUBLIC_STRIPE_ENV which is baked into the build.
// They exist so existing server components that don't need a runtime toggle
// can keep a simple import. New code should call getStripeClient() instead.

const _isLive = process.env.NEXT_PUBLIC_STRIPE_ENV === 'live';

const _staticSecretKey =
  (_isLive
    ? process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY) ||
  'sk_test_placeholder_for_static_builds';

/** @deprecated Use getStripeClient() for runtime mode resolution. */
export const stripe = new Stripe(_staticSecretKey, {
  apiVersion: API_VERSION,
  typescript: true,
});

/** @deprecated Use getStripeClient().webhookSecret */
export const stripeWebhookSecret = _isLive
  ? process.env.STRIPE_LIVE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
  : process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

/** @deprecated Use getStripeClient().publishableKey */
export const stripePublishableKey = _isLive
  ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  : process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// ── Dynamic client — DB-driven mode, resolved at request time ─────────────────

export interface StripePriceIds {
  monthly:    string | undefined;
  quarterly:  string | undefined;
  six_months: string | undefined;
  yearly:     string | undefined;
}

export interface StripeContext {
  client:         Stripe;
  mode:           StripeMode;
  webhookSecret:  string | undefined;
  publishableKey: string | undefined;
  priceIds:       StripePriceIds;
}

/**
 * Returns a Stripe client configured for whichever mode (live | test) is
 * currently stored in app_config. Use this in any route that needs to respect
 * the admin toggle rather than the static build-time flag.
 */
export async function getStripeClient(): Promise<StripeContext> {
  const mode = await getStripeMode();
  const live  = mode === 'live';

  const secretKey =
    (live
      ? process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY) ||
    'sk_test_placeholder_for_static_builds';

  return {
    client: new Stripe(secretKey, { apiVersion: API_VERSION, typescript: true }),
    mode,
    webhookSecret: live
      ? process.env.STRIPE_LIVE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
      : process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: live
      ? process.env.NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      : process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    priceIds: {
      monthly:    live ? process.env.STRIPE_PRICE_FOUNDING_MONTHLY    : process.env.STRIPE_TEST_PRICE_FOUNDING_MONTHLY,
      quarterly:  live ? process.env.STRIPE_PRICE_FOUNDING_QUARTERLY  : process.env.STRIPE_TEST_PRICE_FOUNDING_QUARTERLY,
      six_months: live ? process.env.STRIPE_PRICE_FOUNDING_SIX_MONTHS : process.env.STRIPE_TEST_PRICE_FOUNDING_SIX_MONTHS,
      yearly:     live ? process.env.STRIPE_PRICE_FOUNDING_YEARLY     : process.env.STRIPE_TEST_PRICE_FOUNDING_YEARLY,
    },
  };
}

/**
 * Builds a Stripe client directly from livemode boolean — for use inside the
 * webhook handler where we peek at event.livemode before verifying the signature.
 * Avoids a DB read for every inbound webhook.
 */
export function getStripeClientForLivemode(livemode: boolean): {
  client: Stripe;
  webhookSecret: string | undefined;
} {
  const secretKey =
    (livemode
      ? process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY
      : process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY) ||
    'sk_test_placeholder_for_static_builds';

  return {
    client: new Stripe(secretKey, { apiVersion: API_VERSION, typescript: true }),
    webhookSecret: livemode
      ? process.env.STRIPE_LIVE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
      : process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET,
  };
}
