/** Read-only active Xero chart for one connected Flowen entity. No tokens or writes. */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { getAllXeroTokens, listChartOfAccounts } from '@/lib/xero';
import { isXeroEntitySlug } from '@/lib/flowen-entities';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const entity = req.nextUrl.searchParams.get('entity');
  if (!isXeroEntitySlug(entity ?? '')) {
    return NextResponse.json({ error: 'A valid entity is required' }, { status: 400 });
  }
  // Narrow the nullable query parameter after the runtime slug validation.
  const slug = entity as Parameters<typeof listChartOfAccounts>[0];
  try {
    const token = (await getAllXeroTokens()).find(row => row.entity === slug && row.tenant_id);
    if (!token) return NextResponse.json({ error: 'Entity is not connected to Xero' }, { status: 409 });
    const accounts = (await listChartOfAccounts(slug)).map(({ Code, Name, Type, Class }) => ({
      code: Code, name: Name, type: Type, class: Class,
    }));
    return NextResponse.json({ entity: slug, tenantName: token.tenant_name, accounts }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not read the live Xero chart of accounts' }, { status: 502 });
  }
}
