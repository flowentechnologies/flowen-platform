/**
 * Builds the GA4 `start_trial` event payload for the post-checkout welcome
 * page.
 *
 * Why start_trial and not purchase (2026-09-29): checkout here ALWAYS runs
 * with a 7-day free trial (see /api/stripe/checkout), so amount_total is
 * £0 — nothing is collected today. This builder previously reported the
 * plan's recurring price as a GA4 `purchase`, which fed a false revenue
 * signal to every platform reading that event, including Google Ads
 * bidding. A trial start is not revenue: the event is now `start_trial`
 * with value 0, and it must never be mapped to a paid-purchase goal.
 *
 * Real paid purchases are reported server-side only, from the verified
 * Stripe invoice webhook with the actual collected amount — see
 * src/lib/analytics/paid-conversion.ts.
 *
 * Data is still pulled from the real Stripe Checkout Session — never
 * hardcoded — so transaction_id, currency and the item list are genuine
 * per-checkout data.
 */

export interface StripeLineItemLike {
  quantity?: number | null;
  description?: string | null;
  price?: {
    unit_amount?: number | null;
    nickname?: string | null;
    // Stripe's own type is `string | Product | DeletedProduct` when expanded —
    // a DeletedProduct has no guaranteed `name`, so this stays an untyped
    // object shape rather than requiring one, with a safe lookup at the call site.
    product?: string | object | null;
  } | null;
}

export interface StartTrialEventPayload {
  transaction_id: string;
  value: number; // always 0 — a trial collects nothing
  currency: string;
  items: Array<{ item_id: string; item_name: string; price: number; quantity: number }>;
}

export function buildStartTrialEventPayload(
  sessionId: string,
  currency: string | null | undefined,
  lineItems: StripeLineItemLike[],
): StartTrialEventPayload {
  const items = lineItems.map((li, i) => {
    const unitAmount = li.price?.unit_amount ?? 0;
    const quantity = li.quantity ?? 1;
    const product = li.price?.product;
    const productName =
      (typeof product === 'object' && product !== null && 'name' in product && typeof product.name === 'string'
        ? product.name
        : null) ||
      li.price?.nickname ||
      li.description ||
      'Flowen Subscription';
    const itemId =
      (typeof product === 'string' && product) ||
      li.price?.nickname ||
      `item_${i}`;

    return {
      item_id:   itemId,
      item_name: productName,
      // Plan catalogue price is fine as item metadata; it is NOT the value
      // of this event — nothing was collected.
      price:     Math.round(unitAmount) / 100,
      quantity,
    };
  });

  return {
    transaction_id: sessionId,
    value:          0,
    currency:       (currency ?? 'gbp').toUpperCase(),
    items,
  };
}
