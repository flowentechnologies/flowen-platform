/**
 * /api/admin/inbox
 *
 * GET   — list synced inbox items, optionally filtered by ?category= or
 *         ?alias=. Read-only; drafting/sending happens via /api/admin/drafts.
 * PATCH — mark an item's status (read/archived) — no send capability here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const alias = searchParams.get('alias');

  const supabase = db();
  let query = supabase
    .from('inbox_items')
    .select('*, ai_drafts(id, status, confidence_pct)')
    .order('received_at', { ascending: false })
    .limit(200);
  if (category) query = query.eq('category', category);
  if (alias) query = query.eq('alias', alias);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: tokenRow } = await supabase.from('gmail_oauth_tokens').select('mailbox, connected_at').eq('id', 'admin').maybeSingle();

  return NextResponse.json({ items: data, gmail_connected: !!tokenRow, connected_at: tokenRow?.connected_at ?? null });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as { id?: string; status?: 'read' | 'archived' | 'unread' };
  if (!body.id || !body.status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const { error } = await db().from('inbox_items').update({ status: body.status }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
