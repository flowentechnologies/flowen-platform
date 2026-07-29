import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { stripe, stripeWebhookSecret } from '@/lib/stripe';

// ── Types ────────────────────────────────────────────────────────────────────

type SubscriptionTier   = 'founding' | 'standard' | 'public_funds' | 'vocali_freemium';
type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
type BillingCycle       = 'monthly' | 'quarterly' | 'six_months' | 'yearly';

// ── Pricing matrix ────────────────────────────────────────────────────────────
// Maps each environment-configured price ID to its tier and billing cycle.
// All four founding-member price IDs resolve to 'founding'; the cycle label is
// persisted for billing analytics and dunning-email personalisation.

const PRICE_MATRIX: Record<string, { tier: SubscriptionTier; cycle: BillingCycle }> = {
  ...(process.env.STRIPE_PRICE_FOUNDING_MONTHLY    && {
    [process.env.STRIPE_PRICE_FOUNDING_MONTHLY]:    { tier: 'founding', cycle: 'monthly'    },
  }),
  ...(process.env.STRIPE_PRICE_FOUNDING_QUARTERLY  && {
    [process.env.STRIPE_PRICE_FOUNDING_QUARTERLY]:  { tier: 'founding', cycle: 'quarterly'  },
  }),
  ...(process.env.STRIPE_PRICE_FOUNDING_SIX_MONTHS && {
    [process.env.STRIPE_PRICE_FOUNDING_SIX_MONTHS]: { tier: 'founding', cycle: 'six_months' },
  }),
  ...(process.env.STRIPE_PRICE_FOUNDING_YEARLY     && {
    [process.env.STRIPE_PRICE_FOUNDING_YEARLY]:     { tier: 'founding', cycle: 'yearly'     },
  }),
};

// Derive tier + cycle from Stripe plan interval when price IDs aren't configured
// (dev / staging without full env set).
function resolvePlanMeta(plan: Stripe.Plan): { tier: SubscriptionTier; cycle: BillingCycle } {
  if (plan.id && PRICE_MATRIX[plan.id]) return PRICE_MATRIX[plan.id];

  const cycle: BillingCycle =
    plan.interval === 'year'      ? 'yearly'    :
    plan.interval_count === 6     ? 'six_months':
    plan.interval_count === 3     ? 'quarterly' : 'monthly';

  return { tier: 'founding', cycle };
}

// Map Stripe status values onto our DB enum, collapsing unsupported variants.
function normaliseStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
    active:             'active',
    trialing:           'trialing',
    past_due:           'past_due',
    canceled:           'canceled',
    unpaid:             'unpaid',
    incomplete:         'incomplete',
    incomplete_expired: 'canceled',
    paused:             'past_due',
  };
  return map[s] ?? 'incomplete';
}

// ── Admin Supabase client ─────────────────────────────────────────────────────
// Service-role key bypasses RLS. Only used in this webhook — no user session.

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type AdminClient = ReturnType<typeof createAdminClient>;

// ── User resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the internal user UUID from a Stripe customer ID.
 *
 * Primary path:  indexed `customers` table (sub-millisecond).
 * Fallback path: `auth.users` email scan — only fires on the very first payment
 *                before a `customers` row has been written.
 */
async function resolveUserId(
  admin: AdminClient,
  stripeCustomerId: string,
  fallbackEmail: string | null,
): Promise<string | null> {
  const { data: row } = await admin
    .from('customers')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();

  if (row?.id) return row.id as string;
  if (!fallbackEmail) return null;

  const { data: authUser } = await admin
    .schema('auth')
    .from('users')
    .select('id')
    .eq('email', fallbackEmail)
    .maybeSingle();

  return (authUser?.id as string) ?? null;
}

// Idempotent link between internal UUID and Stripe customer ID.
async function ensureCustomerRecord(
  admin: AdminClient,
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await admin
    .from('customers')
    .upsert(
      { id: userId, stripe_customer_id: stripeCustomerId },
      { onConflict: 'id', ignoreDuplicates: true },
    );
}

// ── Database writers ──────────────────────────────────────────────────────────

async function setProfileTier(
  admin: AdminClient,
  userId: string,
  tier: SubscriptionTier,
): Promise<void> {
  const { error } = await admin
    .from('profiles')
    .update({ tier, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`profiles.tier update failed: ${error.message}`);
}

async function upsertSubscription(
  admin: AdminClient,
  sub: Stripe.Subscription,
  userId: string,
): Promise<void> {
  const priceId = sub.items.data[0]?.price.id ?? '';
  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        id:                   sub.id,
        user_id:              userId,
        status:               normaliseStatus(sub.status),
        price_id:             priceId,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_start: new Date((sub.current_period_start as number) * 1000).toISOString(),
        current_period_end:   new Date((sub.current_period_end   as number) * 1000).toISOString(),
      },
      { onConflict: 'id' },
    );

  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
}

async function logError(
  admin: AdminClient,
  source: string,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await admin.from('system_error_logs').insert({
    source:      `webhook/stripe/${source}`,
    error_code:  'WEBHOOK_HANDLER_ERROR',
    message,
    metadata,
    environment: process.env.NODE_ENV ?? 'production',
  });
}

// ── Event handlers ────────────────────────────────────────────────────────────

async function handleCheckoutSessionCompleted(
  admin: AdminClient,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const stripeCustomerId =
    typeof session.customer === 'string' ? session.customer
    : (session.customer as Stripe.Customer | null)?.id ?? null;

  if (!stripeCustomerId) {
    throw new Error(`checkout.session.completed missing customer (session: ${session.id})`);
  }

  const userId = await resolveUserId(admin, stripeCustomerId, session.customer_email);
  if (!userId) {
    throw new Error(
      `Cannot resolve user for customer ${stripeCustomerId} / email ${session.customer_email}`,
    );
  }

  await ensureCustomerRecord(admin, userId, stripeCustomerId);

  if (session.subscription) {
    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription).id;

    // Retrieve full subscription — checkout.session only carries the ID.
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ['items.data.price'],
    });

    const { tier } = resolvePlanMeta(sub.items.data[0]?.plan ?? ({} as Stripe.Plan));
    await setProfileTier(admin, userId, tier);
    await upsertSubscription(admin, sub, userId);
  } else {
    // One-time payment (no recurring subscription) — grant founding tier.
    await setProfileTier(admin, userId, 'founding');
  }
}

async function handleSubscriptionEvent(
  admin: AdminClient,
  sub: Stripe.Subscription,
): Promise<void> {
  const stripeCustomerId =
    typeof sub.customer === 'string' ? sub.customer
    : (sub.customer as Stripe.Customer)?.id ?? null;

  if (!stripeCustomerId) throw new Error(`Subscription ${sub.id} missing customer field`);

  const userId = await resolveUserId(admin, stripeCustomerId, null);
  // Customer may not have a matching Flowen account yet — skip gracefully.
  if (!userId) return;

  await ensureCustomerRecord(admin, userId, stripeCustomerId);
  await upsertSubscription(admin, sub, userId);

  const { tier }  = resolvePlanMeta(sub.items.data[0]?.plan ?? ({} as Stripe.Plan));
  const isActive  = sub.status === 'active' || sub.status === 'trialing';
  await setProfileTier(admin, userId, isActive ? tier : 'standard');
}

async function handleInvoicePaymentSucceeded(
  admin: AdminClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const subRef = invoice.subscription;
  if (!subRef) return;

  const subId = typeof subRef === 'string' ? subRef : (subRef as Stripe.Subscription).id;
  const sub   = await stripe.subscriptions.retrieve(subId, {
    expand: ['items.data.price'],
  });

  const stripeCustomerId =
    typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer).id;

  const userId = await resolveUserId(admin, stripeCustomerId, null);
  if (!userId) return;

  await upsertSubscription(admin, sub, userId);
}

async function handleInvoicePaymentFailed(
  admin: AdminClient,
  invoice: Stripe.Invoice,
): Promise<void> {
  const stripeCustomerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : (invoice.customer as Stripe.Customer)?.id ?? null;

  if (!stripeCustomerId) return;

  await logError(
    admin,
    'invoice.payment_failed',
    'Subscription renewal payment failed',
    {
      stripe_customer_id: stripeCustomerId,
      invoice_id:         invoice.id,
      amount_due:         invoice.amount_due,
      currency:           invoice.currency,
      attempt_count:      invoice.attempt_count,
    },
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Misconfiguration must surface loudly in logs, not silently swallow events.
  if (!stripeWebhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const rawBody   = await req.text();
  const sigHeader = req.headers.get('stripe-signature');

  if (!sigHeader) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Cryptographic validation — rejects replayed, tampered, or spoofed events.
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, stripeWebhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed';
    return Response.json({ error: msg }, { status: 400 });
  }

  // Dispatch handlers. Always return 200 to Stripe after validation —
  // DB errors are logged internally so Stripe doesn't endlessly re-queue.
  const admin = createAdminClient();

  // Idempotency — silently skip events already processed (Stripe retries on network failure)
  const { data: existing } = await admin
    .from('processed_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existing) return Response.json({ received: true, skipped: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          admin,
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(admin, event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(admin, event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
        break;

      default:
        break;
    }
  } catch (err) {
    const msg   = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack   : undefined;
    await logError(admin, event.type, msg, { event_id: event.id, stack }).catch(() => null);
    console.error(`[stripe-webhook] ${event.type} error:`, msg);
    return Response.json({ received: true });
  }

  // Mark processed only on success so failed events can be retried
  await admin
    .from('processed_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
    .then(({ error }) => {
      if (error) console.error('[stripe-webhook] idempotency insert failed:', error.message);
    });

  return Response.json({ received: true });
}
