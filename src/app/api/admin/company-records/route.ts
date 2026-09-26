/**
 * /api/admin/company-records
 *
 * General company identifiers (Corporation Tax UTR, VAT number, PAYE
 * reference, Companies House auth code) per Flowen group entity — there
 * was nowhere to keep these before. Seeded with Group's Corporation Tax
 * UTR from the HMRC CT41G letter received 26 Sep 2026.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

const VALID_ENTITIES = new Set(['group', 'ip', 'labs', 'speech-technologies']);
const VALID_RECORD_TYPES = new Set(['corporation_tax_utr', 'vat_number', 'paye_reference', 'companies_house_auth_code', 'other']);

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('company_records')
    .select('*')
    .order('entity')
    .order('record_type');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { entity?: string; record_type?: string; value?: string; issued_by?: string; issued_date?: string; notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { entity, record_type, value } = body;
  if (!entity || !record_type || !value) {
    return NextResponse.json({ error: 'entity, record_type, and value are required' }, { status: 400 });
  }
  if (!VALID_ENTITIES.has(entity)) return NextResponse.json({ error: `Invalid entity: ${entity}` }, { status: 400 });
  if (!VALID_RECORD_TYPES.has(record_type)) return NextResponse.json({ error: `Invalid record_type: ${record_type}` }, { status: 400 });

  const { data, error } = await db()
    .from('company_records')
    .insert({ entity, record_type, value, issued_by: body.issued_by ?? null, issued_date: body.issued_date ?? null, notes: body.notes ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'company_record.added', resource_type: 'company_record', resource_id: data.id, metadata: { entity, record_type }, severity: 'info' });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await db().from('company_records').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'company_record.removed', resource_type: 'company_record', resource_id: id, metadata: {}, severity: 'warning' });
  return NextResponse.json({ ok: true });
}
