/**
 * /api/admin/crm
 *
 * GET    — list contacts, optionally filtered by ?category= or ?stage=.
 * POST   — create a contact manually.
 * PATCH  — update a contact (stage, deal value, notes, name/company). A
 *          stage change logs a crm_activities entry automatically. No send
 *          capability here — outreach drafts for a contact go through
 *          /api/admin/drafts like everything else.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const stage = searchParams.get('stage');

  const supabase = db();
  let query = supabase.from('crm_contacts').select('*').order('last_contact_at', { ascending: false, nullsFirst: false }).limit(500);
  if (category) query = query.eq('category', category);
  if (stage) query = query.eq('stage', stage);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as {
    email?: string; name?: string; company?: string; category?: string; notes?: string;
    deal_value_pence?: number; deal_currency?: string;
  };
  if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const { data, error } = await db().from('crm_contacts').insert({
    email: body.email, name: body.name ?? null, company: body.company ?? null,
    category: body.category ?? 'other', notes: body.notes ?? null, source: 'manual',
    deal_value_pence: body.deal_value_pence ?? null, deal_currency: body.deal_currency ?? 'gbp',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as {
    id?: string; stage?: string; notes?: string; company?: string; name?: string;
    deal_value_pence?: number | null; deal_currency?: string;
  };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = db();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.stage) update.stage = body.stage;
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.company !== undefined) update.company = body.company;
  if (body.name !== undefined) update.name = body.name;
  if (body.deal_value_pence !== undefined) update.deal_value_pence = body.deal_value_pence;
  if (body.deal_currency !== undefined) update.deal_currency = body.deal_currency;

  // Log the stage move as a timeline entry before applying it, so the old
  // stage is still readable from the previous row state.
  if (body.stage) {
    const { data: before } = await supabase.from('crm_contacts').select('stage').eq('id', body.id).single();
    if (before && before.stage !== body.stage) {
      await supabase.from('crm_activities').insert({
        crm_contact_id: body.id,
        type: 'stage_change',
        body: `${before.stage} → ${body.stage}`,
        created_by: admin.id,
      });
    }
  }

  const { error } = await supabase.from('crm_contacts').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
