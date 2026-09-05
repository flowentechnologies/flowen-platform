/**
 * GET /api/admin/vendor-invoices
 * Read-only list of vendor/service-provider billing extracted from the
 * inbox sync worker. Distinct from /admin/billing, which is Flowen's own
 * customer-facing Stripe subscription billing (revenue, not spend).
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const vendor = new URL(req.url).searchParams.get('vendor');
  const supabase = db();
  let query = supabase
    .from('vendor_invoices')
    .select('*, inbox_items(subject, from_address, received_at)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (vendor) query = query.eq('vendor_name', vendor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalPence = (data ?? []).reduce((sum, row) => sum + (row.amount_pence ?? 0), 0);
  const byVendor = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    const key = row.vendor_name;
    acc[key] = (acc[key] ?? 0) + (row.amount_pence ?? 0);
    return acc;
  }, {});

  return NextResponse.json({ invoices: data, total_pence: totalPence, by_vendor: byVendor });
}
