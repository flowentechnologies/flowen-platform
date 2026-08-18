import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

// ── GET — list all compliance items ──────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();

  const { data, error } = await supabase
    .from('compliance_items')
    .select('*')
    .order('framework')
    .order('item_code');

  // Gracefully handle missing table (code 42P01 = relation does not exist)
  if (error) {
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json({ items: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

// ── POST — upsert a compliance item ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    framework?: string;
    item_code?: string;
    status?: string;
    notes?: string;
    evidence_url?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { framework, item_code, status, notes, evidence_url } = body;

  if (!framework || !item_code || !status) {
    return NextResponse.json(
      { error: 'framework, item_code, and status are required' },
      { status: 400 },
    );
  }

  const VALID_FRAMEWORKS = new Set(['dcb0129', 'dtac', 'dspt', 'mhra', 'wcag']);
  const VALID_STATUSES   = new Set(['not_started', 'in_progress', 'complete', 'not_applicable', 'blocked']);

  if (!VALID_FRAMEWORKS.has(framework)) {
    return NextResponse.json({ error: `Invalid framework: ${framework}` }, { status: 400 });
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  const supabase = db();

  const { data, error } = await supabase
    .from('compliance_items')
    .upsert(
      {
        framework,
        item_code,
        status,
        notes:        notes        ?? null,
        evidence_url: evidence_url ?? null,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'framework,item_code' },
    )
    .select()
    .single();

  if (error) {
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '42P01' || error.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'compliance_items table does not exist. Please run the migration first.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'compliance.status_update', resource_type: 'compliance_item', resource_id: data.id, metadata: { framework, item_code, status }, severity: 'info' });
  return NextResponse.json({ item: data });
}
