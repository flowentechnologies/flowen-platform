import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/admin/audit';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

// ── GET — all staff data ──────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();

  // Fetch admins from profiles + auth.users + staff metadata
  const [profilesRes, authRes, staffMetaRes, invitesRes, handoffRes] = await Promise.all([
    supabase.from('profiles').select('id,display_name,is_admin,created_at').eq('is_admin', true),
    supabase.schema('auth').from('users').select('id,email,last_sign_in_at,created_at'),
    supabase.from('staff_members').select('*'),
    supabase.from('staff_invites').select('*').order('created_at', { ascending: false }),
    supabase.from('handoff_notes').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  const profiles  = profilesRes.data  ?? [];
  const authUsers = (authRes.data     ?? []) as { id: string; email: string; last_sign_in_at: string | null; created_at: string }[];
  const staffMeta = staffMetaRes.data ?? [];
  const invites   = invitesRes.data   ?? [];
  const handoffs  = handoffRes.data   ?? [];

  const authMap = Object.fromEntries(authUsers.map(u => [u.id, u]));
  const metaMap = Object.fromEntries(staffMeta.map(m => [m.id, m]));

  const members = profiles.map(p => ({
    id:               p.id,
    email:            authMap[p.id]?.email ?? null,
    display_name:     p.display_name ?? null,
    last_sign_in_at:  authMap[p.id]?.last_sign_in_at ?? null,
    profile_created:  p.created_at,
    role:             metaMap[p.id]?.role ?? 'admin',
    department:       metaMap[p.id]?.department ?? null,
    title:            metaMap[p.id]?.title ?? null,
    bio:              metaMap[p.id]?.bio ?? null,
    status:           metaMap[p.id]?.status ?? 'active',
    joined_at:        metaMap[p.id]?.joined_at ?? p.created_at,
  }));

  return NextResponse.json({ members, invites, handoffs });
}

// ── POST — mutations ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; [k: string]: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const supabase = db();
  const { action } = body;

  // ── Member management ────────────────────────────────────────────────────────

  if (action === 'upsert_member_meta') {
    const { id, role, department, title, bio, status } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('staff_members').upsert({
      id, role: role || 'admin',
      department: department || null,
      title: title || null,
      bio: bio || null,
      status: status || 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'revoke_admin') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Block self-removal
    if (id === admin.id) {
      return NextResponse.json({ error: 'Cannot revoke your own admin access' }, { status: 400 });
    }

    // Guard against removing the last admin
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_admin', true);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last admin account' }, { status: 400 });
    }

    const { error } = await supabase.from('profiles').update({ is_admin: false }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from('staff_members').update({ status: 'inactive', updated_at: new Date().toISOString() }).eq('id', id);
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'staff.removed', resource_type: 'staff_member', resource_id: id, severity: 'warning' });
    return NextResponse.json({ success: true });
  }

  // ── Invites ──────────────────────────────────────────────────────────────────

  if (action === 'create_invite') {
    const { email, role, department, invited_by_email } = body as Record<string, string>;
    if (!email || !invited_by_email) return NextResponse.json({ error: 'email and invited_by_email required' }, { status: 400 });
    const { data, error } = await supabase.from('staff_invites').insert({
      email, role: role || 'admin',
      department: department || null,
      invited_by_email,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'staff.invited', resource_type: 'staff_invite', resource_id: data.id, metadata: { email, role: role || 'admin' }, severity: 'info' });
    return NextResponse.json({ data, inviteUrl: `${SITE}/admin/join/${data.token}` });
  }

  if (action === 'revoke_invite') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('staff_invites').update({ revoked: true }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_invite') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('staff_invites').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Handoff notes ────────────────────────────────────────────────────────────

  if (action === 'create_handoff') {
    const { author_email, author_name, shift, summary, action_items, flags } = body as Record<string, unknown>;
    if (!author_email || !summary) return NextResponse.json({ error: 'author_email and summary required' }, { status: 400 });
    const { data, error } = await supabase.from('handoff_notes').insert({
      author_email, author_name: author_name || null,
      shift: shift || 'morning',
      summary, action_items: action_items || null,
      flags: flags || [],
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'delete_handoff') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('handoff_notes').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
