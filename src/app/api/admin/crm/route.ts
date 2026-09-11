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
  const source = searchParams.get('source');
  // Explee-sourced contacts went from a handful of hot leads to 1,000+
  // once every emailed contact started importing (see
  // explee-outreach-sync step 4) — the old fixed 500 silently truncated
  // the list with no indication to the UI that more existed.
  const limit = Math.min(Number(searchParams.get('limit')) || 2000, 5000);
  const offset = Number(searchParams.get('offset')) || 0;

  const supabase = db();
  // Embed each contact's linked explee_contacts row(s) — campaign,
  // Explee's own intent classification, touch counts, latest subject —
  // so the admin UI can show real outreach context without an N+1 fetch
  // per card for what may be 1,000+ contacts.
  let query = supabase
    .from('crm_contacts')
    .select(`
      *,
      explee_contacts (
        campaign_id, latest_subject, latest_intent, latest_sent_at, latest_reply_at,
        sent_count, reply_count,
        explee_campaigns ( name )
      )
    `, { count: 'exact' })
    .order('last_contact_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (category) query = query.eq('category', category);
  if (stage) query = query.eq('stage', stage);
  if (source) query = query.eq('source', source);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data, has_more: (data?.length ?? 0) === limit, count: count ?? undefined });
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
  // A human explicitly setting a stage takes it out of Explee's automatic
  // sorting for good — otherwise the next sync would derive a stage from
  // Explee's own signals and silently bounce a deliberate "won"/"lost"
  // call (or any manual move) back to whatever Explee last classified it
  // as. See explee-outreach-sync's stage re-sync step.
  if (body.stage) { update.stage = body.stage; update.stage_auto_managed = false; }
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
