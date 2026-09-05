/**
 * /api/admin/inbox
 *
 * GET   — list synced inbox items, optionally filtered by ?category=,
 *         ?alias=, ?gmail_category= (primary/social/promotions/updates/
 *         forums/spam — Gmail's own inbox-tab classification, distinct
 *         from `category` which is alias/vendor-driven), and/or ?q= (a
 *         full-text search across subject/snippet/body/from). Excludes
 *         archived items unless ?status=archived or ?status=all is
 *         passed. Paginated via ?offset= (default 0) with a fixed page
 *         size of 50 — returns has_more so the UI can show "Load more".
 *         Also returns alias_counts and gmail_category_counts (over the
 *         most recent 500 items, unfiltered) so the UI can render
 *         grouping chips with counts regardless of the current filter.
 *         Read-only; drafting/sending happens via /api/admin/drafts.
 * PATCH — mark an item's status (read/archived/unread) — no send
 *         capability here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const PAGE_SIZE = 50;

function countBy(rows: { alias?: string; gmail_category?: string | null }[], key: 'alias' | 'gmail_category'): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = row[key];
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const alias = searchParams.get('alias');
  const gmailCategory = searchParams.get('gmail_category');
  const q = searchParams.get('q')?.trim();
  const status = searchParams.get('status'); // 'archived' | 'all' | null (null = default, excludes archived)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

  const supabase = db();
  let query = supabase
    .from('inbox_items')
    .select('*, ai_drafts(id, status, confidence_pct)', { count: 'exact' })
    .order('received_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (category) query = query.eq('category', category);
  if (alias) query = query.eq('alias', alias);
  if (gmailCategory) query = query.eq('gmail_category', gmailCategory);
  if (status === 'archived') query = query.eq('status', 'archived');
  else if (status !== 'all') query = query.neq('status', 'archived');
  if (q) {
    const escaped = q.replace(/[%,]/g, '');
    query = query.or(`subject.ilike.%${escaped}%,snippet.ilike.%${escaped}%,body_text.ilike.%${escaped}%,from_address.ilike.%${escaped}%,from_name.ilike.%${escaped}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: countRows } = await supabase
    .from('inbox_items')
    .select('alias, gmail_category')
    .neq('status', 'archived')
    .order('received_at', { ascending: false })
    .limit(500);

  const { data: tokenRow } = await supabase.from('gmail_oauth_tokens').select('mailbox, connected_at').eq('id', 'admin').maybeSingle();

  return NextResponse.json({
    items: data,
    has_more: (count ?? 0) > offset + PAGE_SIZE,
    total: count ?? 0,
    gmail_connected: !!tokenRow,
    connected_at: tokenRow?.connected_at ?? null,
    alias_counts: countBy(countRows ?? [], 'alias'),
    gmail_category_counts: countBy(countRows ?? [], 'gmail_category'),
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as { id?: string; status?: 'read' | 'archived' | 'unread' };
  if (!body.id || !body.status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });

  const { error } = await db().from('inbox_items').update({ status: body.status }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
