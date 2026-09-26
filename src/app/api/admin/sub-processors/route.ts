/**
 * /api/admin/sub-processors
 *
 * The real, admin-editable sub-processor register — GET lists it (active
 * first), POST adds a new one, PATCH updates/deactivates an existing one.
 * src/app/dpa/page.tsx reads the active rows live instead of a hardcoded
 * array, so a new vendor can't go undisclosed the way OpenAI/ElevenLabs/
 * Agora did before this existed — see supabase/migrations/
 * 20260926_governance_registers.sql for how those three plus the original
 * five were seeded.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('sub_processors')
    .select('*')
    .order('active', { ascending: false })
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string; purpose?: string; data_categories?: string; location?: string; safeguard?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, purpose, data_categories, location, safeguard } = body;
  if (!name || !purpose || !data_categories || !location || !safeguard) {
    return NextResponse.json({ error: 'name, purpose, data_categories, location, and safeguard are all required' }, { status: 400 });
  }

  const { data, error } = await db()
    .from('sub_processors')
    .insert({ name, purpose, data_categories, location, safeguard })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'sub_processor.added', resource_type: 'sub_processor', resource_id: data.id, metadata: { name }, severity: 'info' });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: string; active?: boolean; name?: string; purpose?: string; data_categories?: string; location?: string; safeguard?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data, error } = await db()
    .from('sub_processors')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'sub_processor.updated', resource_type: 'sub_processor', resource_id: id, metadata: fields, severity: fields.active === false ? 'warning' : 'info' });
  return NextResponse.json({ item: data });
}
