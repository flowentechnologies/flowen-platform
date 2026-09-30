import 'server-only';

export interface Ga4Identity { client_id: string; session_id?: string | null; captured_at: string }
export function buildGa4Purchase(identity: Ga4Identity, invoiceId: string, amountPence: number, currency: string, paidAt: string, now = Date.now()) {
  const paid = Date.parse(paidAt);
  if (!/^\d+\.\d+$/.test(identity.client_id) || !invoiceId || amountPence <= 0 || !Number.isFinite(paid)) return null;
  // Do not silently move old/future revenue to today (MP accepts at most 72h backdating).
  if (paid < now - 72 * 3600_000 || paid > now + 60_000) return null;
  // Offline invoices do not prove that a browser session is still active.
  // Join via client_id only, never fabricate session engagement/attribution.
  return {
    client_id: identity.client_id,
    timestamp_micros: paid * 1000,
    consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' },
    events: [{ name: 'purchase', params: {
      transaction_id: invoiceId, value: amountPence / 100, currency: currency.toUpperCase(),
      items: [{ item_id: 'flowen_membership', item_name: 'Flowen membership', price: amountPence / 100, quantity: 1 }],
    } }],
  };
}
