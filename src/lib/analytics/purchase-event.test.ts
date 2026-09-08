import { describe, it, expect } from 'vitest';
import { buildPurchaseEventPayload } from './purchase-event';

describe('buildPurchaseEventPayload', () => {
  it('builds a payload from a real Stripe line item, using the recurring price not amount_total', () => {
    const payload = buildPurchaseEventPayload('cs_test_123', 'gbp', [
      { quantity: 1, price: { unit_amount: 1996, nickname: 'Founding Yearly', product: { name: 'Flowen Founding Member' } } },
    ]);
    expect(payload).toEqual({
      transaction_id: 'cs_test_123',
      value: 19.96,
      currency: 'GBP',
      items: [{ item_id: 'Founding Yearly', item_name: 'Flowen Founding Member', price: 19.96, quantity: 1 }],
    });
  });

  it('uppercases the currency', () => {
    const payload = buildPurchaseEventPayload('cs_1', 'usd', [{ quantity: 1, price: { unit_amount: 1000 } }]);
    expect(payload.currency).toBe('USD');
  });

  it('defaults currency to GBP when Stripe omits it', () => {
    const payload = buildPurchaseEventPayload('cs_1', null, [{ quantity: 1, price: { unit_amount: 1000 } }]);
    expect(payload.currency).toBe('GBP');
  });

  it('multiplies price by quantity for the total value', () => {
    const payload = buildPurchaseEventPayload('cs_1', 'gbp', [
      { quantity: 3, price: { unit_amount: 500 } },
    ]);
    expect(payload.value).toBe(15);
  });

  it('sums multiple line items into one total value', () => {
    const payload = buildPurchaseEventPayload('cs_1', 'gbp', [
      { quantity: 1, price: { unit_amount: 1996 } },
      { quantity: 1, price: { unit_amount: 500 } },
    ]);
    expect(payload.value).toBe(24.96);
    expect(payload.items).toHaveLength(2);
  });

  it('falls back sensibly when price/product data is missing', () => {
    const payload = buildPurchaseEventPayload('cs_1', 'gbp', [{}]);
    expect(payload.items[0]).toEqual({ item_id: 'item_0', item_name: 'Flowen Subscription', price: 0, quantity: 1 });
    expect(payload.value).toBe(0);
  });

  it('rounds to avoid floating-point drift', () => {
    const payload = buildPurchaseEventPayload('cs_1', 'gbp', [
      { quantity: 1, price: { unit_amount: 1996 } },
      { quantity: 1, price: { unit_amount: 1 } },
    ]);
    expect(payload.value).toBe(19.97);
  });

  it('uses the string product id as item_id when product is not expanded to an object', () => {
    const payload = buildPurchaseEventPayload('cs_1', 'gbp', [
      { quantity: 1, price: { unit_amount: 1996, product: 'prod_abc123' } },
    ]);
    expect(payload.items[0].item_id).toBe('prod_abc123');
  });
});
