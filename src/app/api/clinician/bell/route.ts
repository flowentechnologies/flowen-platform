/**
 * /api/clinician/bell
 *
 * Real-time notification feed for clinicians — new patient message, patient
 * completed a session. Rows are created by DB triggers (see migration
 * 20260907_slp_notifications.sql) on slp_messages/practice_sessions inserts,
 * not by this route — this only reads/marks them.
 *
 * Mirrors /api/admin/bell's shape (GET list, PATCH mark read) so the client
 * component can reuse the same rendering/chime pattern as the admin bell.
 *
 * GET   — recent notifications (default: unread only) for the current user.
 * PATCH — mark one {id} or all {all: true} as read.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminDb as db } from '@/lib/supabase/admin';

async function requireClinician() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = db();
  const { data: profile } = await admin.from('profiles').select('role, is_admin').eq('id', user.id).single();
  if (!profile || (profile.role !== 'clinician' && profile.role !== 'slp' && !profile.is_admin)) return null;

  return user;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await requireClinician();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const showAll = new URL(req.url).searchParams.get('all') === 'true';
  const supabase = db();
  let query = supabase.from('slp_notifications').select('*').eq('slp_user_id', user.id).order('created_at', { ascending: false }).limit(100);
  if (!showAll) query = query.is('read_at', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count: unreadCount } = await supabase
    .from('slp_notifications').select('*', { count: 'exact', head: true }).eq('slp_user_id', user.id).is('read_at', null);

  return NextResponse.json({ notifications: data, unread_count: unreadCount ?? 0 });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await requireClinician();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as { id?: string; all?: boolean };
  const supabase = db();
  const now = new Date().toISOString();

  if (body.all) {
    const { error } = await supabase.from('slp_notifications').update({ read_at: now }).eq('slp_user_id', user.id).is('read_at', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ error: 'id or all required' }, { status: 400 });
  // Scope to slp_user_id too — not just id — so a clinician can't mark another
  // clinician's notification read by guessing/enumerating a UUID.
  const { error } = await supabase.from('slp_notifications').update({ read_at: now }).eq('id', body.id).eq('slp_user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
