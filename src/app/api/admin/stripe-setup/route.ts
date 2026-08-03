import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST() {

  const results: Record<string, unknown> = {};

  // ── 1. Update webhook to include checkout.session.completed ───────────────
  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
    const existing = webhooks.data.find(w =>
      w.url.includes('flowen.digital/api/webhooks/stripe')
    );

    const events = [
      'checkout.session.completed',
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ];

    if (existing) {
      const updated = await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: events,
      });
      results.webhook = { action: 'updated', id: updated.id, events: updated.enabled_events };
    } else {
      const created = await stripe.webhookEndpoints.create({
        url: 'https://www.flowen.digital/api/webhooks/stripe',
        enabled_events: events,
      });
      results.webhook = { action: 'created', id: created.id, secret: created.secret };
    }
  } catch (err) {
    results.webhook = { error: err instanceof Error ? err.message : String(err) };
  }

  // ── 2. Create billing portal configuration ────────────────────────────────
  try {
    const configs = await stripe.billingPortal.configurations.list({ limit: 1 });
    if (configs.data.length > 0) {
      results.portal = { action: 'already_exists', id: configs.data[0].id };
    } else {
      const portal = await stripe.billingPortal.configurations.create({
        business_profile: {
          headline: 'Manage your Flowen subscription',
          privacy_policy_url: 'https://www.flowen.digital/legal',
          terms_of_service_url: 'https://www.flowen.digital/legal',
        },
        features: {
          customer_update: {
            enabled: true,
            allowed_updates: ['email', 'name'],
          },
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: {
            enabled: true,
            mode: 'at_period_end',
            cancellation_reason: {
              enabled: true,
              options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
            },
          },
          subscription_update: {
            enabled: false,
            default_allowed_updates: [],
            proration_behavior: 'none',
          },
        },
        default_return_url: 'https://www.flowen.digital/dashboard/billing',
      });
      results.portal = { action: 'created', id: portal.id };
    }
  } catch (err) {
    results.portal = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(results);
}
