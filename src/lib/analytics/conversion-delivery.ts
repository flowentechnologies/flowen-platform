import 'server-only';
import { randomUUID } from 'crypto';
import { adminDb } from '@/lib/supabase/admin';

export async function deliverConversion(invoiceId: string, destination: 'meta' | 'google_ads' | 'ga4', userId: string, send: () => Promise<void>): Promise<void> {
  const db = adminDb();
  const claimId = randomUUID();
  const { data: state, error } = await db.rpc('claim_conversion_delivery', {
    p_invoice_id: invoiceId, p_destination: destination, p_user_id: userId, p_claim_id: claimId,
  });
  if (error) throw new Error(`Conversion claim failed (${destination})`);
  if (state === 'sent') return;
  if (state !== 'claimed') throw new Error(`Conversion delivery busy (${destination})`);
  try {
    await send();
    const { error: completionError } = await db.from('conversion_deliveries').update({ state: 'sent', sent_at: new Date().toISOString() })
      .eq('invoice_id', invoiceId).eq('destination', destination).eq('claim_id', claimId);
    if (completionError) throw new Error(`Conversion completion failed (${destination})`);
  } catch {
    await db.from('conversion_deliveries').update({ state: 'failed' })
      .eq('invoice_id', invoiceId).eq('destination', destination).eq('claim_id', claimId);
    // Never expose URLs/tokens/identifiers in the error path.
    throw new Error(`Conversion delivery failed (${destination})`);
  }
}
