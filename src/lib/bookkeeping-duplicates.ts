// ── Duplicate vendor invoice detection ────────────────────────────────────────
// Same-vendor + same-amount + same-currency groups in vendor_invoices — the
// exact pattern that surfaced a real bug (declined-payment emails
// miscategorised as paid bills landing as 3 identical "$5.98 to Explee"
// rows; see isPaymentFailureNotice in inbox-categorize.ts). A genuine
// duplicate charge is rare enough that any group found here is worth a
// human's eyes, not proof of an actual double payment — read-only, no
// writes, used by the bookkeeping Q&A endpoint and safe to call anywhere.

import { adminDb as db } from '@/lib/supabase/admin';

export interface DuplicateVendorInvoiceGroup {
  vendorName: string | null;
  amountPence: number;
  currency: string;
  count: number;
  ids: string[];
}

export async function findDuplicateVendorInvoices(): Promise<DuplicateVendorInvoiceGroup[]> {
  const { data, error } = await db()
    .from('vendor_invoices')
    .select('id, vendor_name, amount_pence, currency')
    .not('amount_pence', 'is', null);
  if (error || !data) return [];

  const groups = new Map<string, DuplicateVendorInvoiceGroup>();
  for (const row of data as { id: string; vendor_name: string | null; amount_pence: number; currency: string }[]) {
    const key = `${row.vendor_name ?? ''}|${row.amount_pence}|${row.currency}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.ids.push(row.id);
    } else {
      groups.set(key, { vendorName: row.vendor_name, amountPence: row.amount_pence, currency: row.currency, count: 1, ids: [row.id] });
    }
  }
  return [...groups.values()].filter(g => g.count > 1);
}
