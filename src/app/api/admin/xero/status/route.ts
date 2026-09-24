/**
 * GET /api/admin/xero/status
 *
 * Read-only connection status for every Flowen group entity, for the
 * /admin/bookkeeping "Connect Xero" panel — never returns the actual tokens.
 * Each of the 4 companies (src/lib/flowen-entities.ts) connects to its own
 * Xero organisation independently, so this returns one row per entity
 * rather than a single connected/disconnected flag.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { getAllXeroTokens } from '@/lib/xero';
import { XERO_ENTITIES } from '@/lib/flowen-entities';

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const rows = await getAllXeroTokens();
  const byEntity = new Map(rows.map(r => [r.entity, r]));

  const entities = XERO_ENTITIES.map(({ slug, name }) => {
    const row = byEntity.get(slug);
    return {
      slug,
      name,
      connected: Boolean(row?.tenant_id),
      tenantName: row?.tenant_name ?? null,
    };
  });

  return NextResponse.json({ entities });
}
