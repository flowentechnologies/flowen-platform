import { describe, it, expect } from 'vitest';
import { buildStartTrialEventPayload } from './purchase-event';

// A trial collects no revenue; keep the event value at zero.
describe('buildStartTrialEventPayload', () => {
  it('reports a free trial with zero event value, not the recurring price', () => {
    const payload = buildStartTrialEventPayload('cs_test_123', 'gbp', [
      { quantity: 1, price: { unit_amount: 1996, nickname: 'Founding Yearly', product: { name: 'Flowen Founding Member' } } },
    ]);
    expect(payload).toEqual({
      transaction_id: 'cs_test_123',
      value: 0,
      currency: 'GBP',
      items: [{ item_id: 'Founding Yearly', item_name: 'Flowen Founding Member', price: 19.96, quantity: 1 }],
    });
  });

  it('defaults currency to GBP and retains quantity without counting it as revenue', () => {
    const payload = buildStartTrialEventPayload('cs_1', null, [
      { quantity: 3, price: { unit_amount: 500 } },
    ]);
    expect(payload.currency).toBe('GBP');
    expect(payload.value).toBe(0);
    expect(payload.items[0]).toEqual({ item_id: 'item_0', item_name: 'Flowen Subscription', price: 5, quantity: 3 });
  });

  it('handles missing product data and string product IDs', () => {
    const payload = buildStartTrialEventPayload('cs_1', 'usd', [
      {},
      { price: { unit_amount: 1996, product: 'prod_abc123' } },
    ]);
    expect(payload.currency).toBe('USD');
    expect(payload.value).toBe(0);
    expect(payload.items[0]).toEqual({ item_id: 'item_0', item_name: 'Flowen Subscription', price: 0, quantity: 1 });
    expect(payload.items[1].item_id).toBe('prod_abc123');
  });
});
