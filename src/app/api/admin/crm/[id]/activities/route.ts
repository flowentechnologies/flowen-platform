/**
 * /api/admin/crm/[id]/activities
 *
 * GET  — a contact's full timeline: crm_activities entries (auto-logged
 *        inbound/outbound email + stage changes, plus manual calls/
 *        meetings/notes) merged with their actual inbox_items (the real
 *        email content, not just an "email" log line), sorted by time.
 * POST — log a manual interaction (call/meeting/note) — the thing that
 *        was previously impossible to record at all.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const { id } = await params;

  const supabase = db();
  const [{ data: activities, error: actErr }, { data: emails, error: emailErr }] = await Promise.all([
    supabase.from('crm_activities').select('*').eq('crm_contact_id', id).order('occurred_at', { ascending: false }),
    supabase.from('inbox_items').select('id, subject, snippet, received_at, status, alias').eq('crm_contact_id', id).order('received_at', { ascending: false }),
  ]);
  if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 });
  if (emailErr) return NextResponse.json({ error: emailErr.message }, { status: 500 });

  return NextResponse.json({ activities: activities ?? [], emails: emails ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  const { id } = await params;

  const body = await req.json() as { type?: string; body?: string; occurred_at?: string };
  if (!body.type || !['call', 'meeting', 'note'].includes(body.type)) {
    return NextResponse.json({ error: "type must be 'call', 'meeting', or 'note'" }, { status: 400 });
  }
  if (!body.body) return NextResponse.json({ error: 'body required' }, { status: 400 });

  const { data, error } = await db().from('crm_activities').insert({
    crm_contact_id: id,
    type: body.type,
    body: body.body,
    occurred_at: body.occurred_at ?? new Date().toISOString(),
    created_by: admin.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db().from('crm_contacts').update({ last_contact_at: data.occurred_at, updated_at: new Date().toISOString() }).eq('id', id);

  return NextResponse.json({ activity: data });
}
