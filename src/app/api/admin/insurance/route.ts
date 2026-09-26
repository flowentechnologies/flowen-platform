/**
 * /api/admin/insurance
 *
 * Insurance policy register. Deliberately starts empty — no policy has ever
 * existed anywhere in this codebase. This just gives one a real place to
 * live once it exists, and makes the absence visible in the meantime rather
 * than nowhere at all.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('insurance_policies')
    .select('*')
    .order('end_date', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    policy_type?: string; provider?: string; policy_number?: string; entity?: string;
    coverage_amount_pence?: number; start_date?: string; end_date?: string;
    document_url?: string; notes?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.policy_type) {
    return NextResponse.json({ error: 'policy_type is required' }, { status: 400 });
  }

  const { data, error } = await db()
    .from('insurance_policies')
    .insert({
      policy_type: body.policy_type,
      provider: body.provider ?? null,
      policy_number: body.policy_number ?? null,
      entity: body.entity ?? null,
      coverage_amount_pence: body.coverage_amount_pence ?? null,
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      document_url: body.document_url ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'insurance.policy_added', resource_type: 'insurance_policy', resource_id: data.id, metadata: { policy_type: body.policy_type }, severity: 'info' });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await db().from('insurance_policies').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'insurance.policy_removed', resource_type: 'insurance_policy', resource_id: id, metadata: {}, severity: 'warning' });
  return NextResponse.json({ ok: true });
}
