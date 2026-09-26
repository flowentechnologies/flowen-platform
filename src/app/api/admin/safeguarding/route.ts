/**
 * /api/admin/safeguarding
 *
 * Safeguarding concern log — distinct from hazard_log (DCB0129 clinical-
 * software safety hazards, a system defect) and gdpr_requests (a data-
 * subject rights request): this is a record of a concern about a person's
 * welfare, the thing an actual safeguarding policy needs to point to.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

const VALID_CATEGORIES = new Set(['disclosure', 'self_harm_risk', 'referral_needed', 'other']);
const VALID_STATUSES = new Set(['open', 'escalated', 'resolved', 'referred_external']);

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('safeguarding_concerns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { raised_by?: string; patient_user_id?: string; category?: string; description?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  const category = body.category && VALID_CATEGORIES.has(body.category) ? body.category : 'other';

  const { data, error } = await db()
    .from('safeguarding_concerns')
    .insert({
      raised_by: body.raised_by ?? admin.email ?? null,
      patient_user_id: body.patient_user_id ?? null,
      category,
      description: body.description,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A safeguarding concern is always worth a critical-severity audit entry
  // regardless of category — this is the one log where under-flagging is
  // the wrong default to fail toward.
  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'safeguarding.concern_raised', resource_type: 'safeguarding_concern', resource_id: data.id, metadata: { category }, severity: 'critical' });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: string; status?: string; escalated_to?: string; resolution_notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, status, escalated_to, resolution_notes } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (status && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) update.status = status;
  if (escalated_to !== undefined) update.escalated_to = escalated_to;
  if (resolution_notes !== undefined) update.resolution_notes = resolution_notes;
  if (status === 'resolved') update.resolved_at = new Date().toISOString();

  const { data, error } = await db()
    .from('safeguarding_concerns')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'safeguarding.concern_updated', resource_type: 'safeguarding_concern', resource_id: id, metadata: { status }, severity: 'warning' });
  return NextResponse.json({ item: data });
}
