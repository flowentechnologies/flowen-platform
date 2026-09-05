/**
 * /api/admin/bell
 *
 * Generic in-admin notification feed (bell icon + dashboard widget) — new
 * inbox mail, drafts awaiting approval, vendor invoices, new CRM contacts.
 * Named distinctly from /api/admin/notifications, which is the existing
 * business-metric alert system (grant deadlines, GDPR overdue, MRR drop,
 * etc.) — a different, older feature this doesn't replace.
 *
 * GET   — recent notifications (default: unread only).
 * PATCH — mark one {id} or all {all: true} as read.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const showAll = new URL(req.url).searchParams.get('all') === 'true';
  const supabase = db();
  let query = supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(100);
  if (!showAll) query = query.is('read_at', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: unreadCount } = await supabase
    .from('admin_notifications').select('*', { count: 'exact', head: true }).is('read_at', null);

  return NextResponse.json({ notifications: data, unread_count: unreadCount ?? 0 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as { id?: string; all?: boolean };
  const supabase = db();
  const now = new Date().toISOString();

  if (body.all) {
    const { error } = await supabase.from('admin_notifications').update({ read_at: now }).is('read_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ error: 'id or all required' }, { status: 400 });
  const { error } = await supabase.from('admin_notifications').update({ read_at: now }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
