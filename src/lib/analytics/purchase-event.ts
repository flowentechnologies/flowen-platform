/**
 * Builds the GA4 ecommerce `purchase` event payload for the post-checkout
 * confirmation page, per Google's own shape:
 * https://developers.google.com/analytics/devguides/collection/ga4/set-up-ecommerce
 *
 * Pulled entirely from the real Stripe Checkout Session — never hardcoded —
 * so transaction_id, currency, and value are all genuine per-purchase data
 * rather than static placeholders.
 *
 * `value` deliberately uses each line item's real recurring price
 * (Price.unit_amount), not the session's own amount_total: checkout here
 * always runs with a 7-day trial (see /api/stripe/checkout), so
 * amount_total is 0 — nothing is actually charged today. Reporting that as
 * the "purchase" value would tell every ad platform every trial signup is
 * worth £0, which defeats the entire point of conversion-value tracking.
 * The recurring price is the real committed value of what the person just
 * signed up for.
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

export interface PurchaseEventPayload {
  transaction_id: string;
  value: number;
  currency: string;
  items: Array<{ item_id: string; item_name: string; price: number; quantity: number }>;
}

export function buildPurchaseEventPayload(
  sessionId: string,
  currency: string | null | undefined,
  lineItems: StripeLineItemLike[],
): PurchaseEventPayload {
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
      price:     Math.round(unitAmount) / 100,
      quantity,
    };
  });

  const value = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

  return {
    transaction_id: sessionId,
    value:          Math.round(value * 100) / 100, // guard against float drift (e.g. 19.959999999998)
    currency:       (currency ?? 'gbp').toUpperCase(),
    items,
  };
}
