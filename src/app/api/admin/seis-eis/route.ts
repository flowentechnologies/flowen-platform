/**
 * /api/admin/seis-eis
 *
 * Live SEIS Advance Assurance status for Flowen Group Ltd — replaces the
 * static [FILL IN] placeholders in the application letter (src/lib/ip-docs/
 * content.tsx) with a real, admin-editable record. Single-row table: there's
 * one live application in flight, not yet a per-investor tranche history —
 * see the migration comment for why this can be extended later rather than
 * built as a multi-tranche system now, before any tranche actually exists.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

const VALID_STATUSES = new Set(['drafted', 'submitted', 'granted', 'declined']);

const EDITABLE_FIELDS = new Set([
  'advance_assurance_status', 'advance_assurance_submitted_at', 'advance_assurance_reference',
  'consolidated_gross_assets_pence', 'total_fte', 'first_trading_date',
  'prior_eis_vct_investment', 'prior_eis_vct_notes',
  'seis1_filed', 'seis1_filed_at', 'notes',
]);

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db().from('seis_eis_status').select('*').limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: string } & Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  if (rest.advance_assurance_status && !VALID_STATUSES.has(rest.advance_assurance_status as string)) {
    return NextResponse.json({ error: `Invalid advance_assurance_status: ${rest.advance_assurance_status}` }, { status: 400 });
  }

  const fields = Object.fromEntries(Object.entries(rest).filter(([k]) => EDITABLE_FIELDS.has(k)));
  fields.updated_at = new Date().toISOString();

  const { data, error } = await db()
    .from('seis_eis_status')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'seis_eis.status_updated', resource_type: 'seis_eis_status', resource_id: id, metadata: fields, severity: 'info' });
  return NextResponse.json({ item: data });
}
