import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { verifyCronRequest } from '@/lib/cron-auth';
import type Stripe from 'stripe';
import { adminDb as db } from '@/lib/supabase/admin';

const PRICE_MATRIX: Record<string, { tier: string; cycle: string }> = {
  ...(process.env.STRIPE_PRICE_FOUNDING_MONTHLY    && { [process.env.STRIPE_PRICE_FOUNDING_MONTHLY]:    { tier: 'founding', cycle: 'monthly'    } }),
  ...(process.env.STRIPE_PRICE_FOUNDING_QUARTERLY  && { [process.env.STRIPE_PRICE_FOUNDING_QUARTERLY]:  { tier: 'founding', cycle: 'quarterly'  } }),
  ...(process.env.STRIPE_PRICE_FOUNDING_SIX_MONTHS && { [process.env.STRIPE_PRICE_FOUNDING_SIX_MONTHS]: { tier: 'founding', cycle: 'six_months' } }),
  ...(process.env.STRIPE_PRICE_FOUNDING_YEARLY     && { [process.env.STRIPE_PRICE_FOUNDING_YEARLY]:     { tier: 'founding', cycle: 'yearly'     } }),
};

function resolveMeta(plan: Stripe.Plan): { tier: string; cycle: string } {
  if (plan.id && PRICE_MATRIX[plan.id]) return PRICE_MATRIX[plan.id];
  const cycle =
    plan.interval === 'year'  ? 'yearly'     :
    plan.interval_count === 6 ? 'six_months' :
    plan.interval_count === 3 ? 'quarterly'  : 'monthly';
  return { tier: 'founding', cycle };
}

function normaliseStatus(s: Stripe.Subscription.Status): string {
  const map: Partial<Record<Stripe.Subscription.Status, string>> = {
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isManual = req.headers.get('x-triggered-by') !== null;
  const started  = Date.now();
  const runId    = crypto.randomUUID();
  const admin    = db();

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Stream subscriptions page-by-page using the Stripe async iterator instead
    // of autoPagingToArray({ limit: 10_000 }).  autoPagingToArray buffers every
    // subscription into a single array before any processing starts — at 10 000
    // objects that can exhaust the Vercel function's 1 GB memory allocation and
    // delays DB writes until the full list is fetched.
    //
    // The for-await pattern processes each page as it arrives: a customer map
    // lookup batch runs per page, keeping memory usage proportional to
    // page size (max 100 rows) rather than the total subscription count.

    const iter = stripe.subscriptions.list({
      status: 'all',
      expand: ['data.customer', 'data.items.data.price'],
      limit: 100,
    });

    // Per-request customer ID → user ID cache — avoids a DB query for each
    // subscription when a customer has multiple subscriptions.
    const customerCache = new Map<string, string | null>();

    for await (const sub of iter) {
      const stripeCustomerId =
        typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer).id;

      let userId: string | null;
      const cached = customerCache.get(stripeCustomerId);
      if (cached !== undefined) {
        userId = cached;
      } else {
        const { data } = await admin
          .from('customers')
          .select('id')
          .eq('stripe_customer_id', stripeCustomerId)
          .maybeSingle();
        userId = (data?.id as string | undefined) ?? null;
        customerCache.set(stripeCustomerId, userId);
      }

      if (!userId) { skipped++; continue; }

      try {
        const priceId = sub.items.data[0]?.price.id ?? '';
        const { tier, cycle } = resolveMeta(sub.items.data[0]?.plan ?? ({} as Stripe.Plan));
        const status = normaliseStatus(sub.status);
        const isActive = sub.status === 'active' || sub.status === 'trialing';

        await Promise.all([
          admin.from('subscriptions').upsert(
            {
              id:                   sub.id,
              user_id:              userId,
              status,
              price_id:             priceId,
              tier_interval:        cycle,
              cancel_at_period_end: sub.cancel_at_period_end,
              current_period_start: new Date((sub.items.data[0]?.current_period_start ?? 0) * 1000).toISOString(),
              current_period_end:   new Date((sub.items.data[0]?.current_period_end   ?? 0) * 1000).toISOString(),
            },
            { onConflict: 'id' },
          ),
          admin.from('profiles').update({
            tier: isActive ? tier : 'standard',
            updated_at: new Date().toISOString(),
          }).eq('id', userId),
        ]);

        synced++;
      } catch {
        errors++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[subscription-sync] fatal error:', msg);

    if (!isManual) {
      await admin.from('cron_runs').insert({
        id:           runId,
        job_id:       'subscription-sync',
        status:       'error',
        triggered_by: 'schedule',
        duration_ms:  Date.now() - started,
        result:       null,
        error:        msg,
        started_at:   new Date(started).toISOString(),
        finished_at:  new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const result = { synced, skipped, errors };

  if (!isManual) {
    await admin.from('cron_runs').insert({
      id:           runId,
      job_id:       'subscription-sync',
      status:       errors > 0 ? 'partial' : 'success',
      triggered_by: 'schedule',
      duration_ms:  Date.now() - started,
      result,
      error:        null,
      started_at:   new Date(started).toISOString(),
      finished_at:  new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true, ...result });
}


