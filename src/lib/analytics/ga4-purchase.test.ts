import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { buildGa4Purchase } from './ga4-purchase';
const now = Date.parse('2026-09-30T12:00:00Z');
const identity = { client_id: '123.456', session_id: String(Math.floor(now / 1000)), captured_at: new Date(now).toISOString() };
describe('signed invoice GA4 purchase payload', () => {
  it('uses invoice total, currency, real client ID and stable dedup key', () => {
    const result = buildGa4Purchase(identity, 'in_real', 2499, 'gbp', new Date(now).toISOString(), now)!;
    expect(result.client_id).toBe('123.456');
    expect(result.events[0].params).toMatchObject({ transaction_id: 'in_real', value: 24.99, currency: 'GBP' });
    expect(result.events[0].params.items[0]).toMatchObject({ price: 24.99, quantity: 1 });
    expect(result.timestamp_micros).toBe(now * 1000);
    expect(result).not.toHaveProperty('user_id');
  });
  it('never reuses an old trial session', () => {
    const result = buildGa4Purchase({ ...identity, session_id: String(Math.floor(now / 1000) - 7 * 86400) }, 'in_real', 2499, 'gbp', new Date(now).toISOString(), now)!;
    expect(result.events[0].params).not.toHaveProperty('session_id');
  });
  it.each([0,-10])('does not report a free/negative invoice %s', amount => {
    expect(buildGa4Purchase(identity,'in_real',amount,'gbp',new Date(now).toISOString(),now)).toBeNull();
  });
  it('rejects fake/invalid client IDs and old timestamps instead of rewriting', () => {
    expect(buildGa4Purchase({...identity,client_id:'made-up'},'in_real',100,'gbp',new Date(now).toISOString(),now)).toBeNull();
    expect(buildGa4Purchase(identity,'in_real',100,'gbp',new Date(now-73*3600_000).toISOString(),now)).toBeNull();
  });
});
