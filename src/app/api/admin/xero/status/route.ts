/**
 * GET /api/admin/xero/status
 *
 * Read-only connection status for the /admin/bookkeeping "Connect Xero"
 * banner — never returns the actual tokens.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { getStoredXeroTokens } from '@/lib/xero';

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const row = await getStoredXeroTokens();
  return NextResponse.json({
    connected: Boolean(row?.tenant_id),
    tenantName: row?.tenant_name ?? null,
  });
}
