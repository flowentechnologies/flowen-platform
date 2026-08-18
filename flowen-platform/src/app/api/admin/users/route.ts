import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

interface ProfileRow {
  id: string;
  display_name: string | null;
  tier: string | null;
  is_admin: boolean;
  early_access: boolean;
  onboarding_complete: boolean;
  created_at: string;
}

interface AuthUserRow {
  id: string;
  email: string;
  last_sign_in_at: string | null;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  display_name: string | null;
  tier: string | null;
  is_admin: boolean;
  early_access: boolean;
  onboarding_complete: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}



export async function GET(request: NextRequest) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get('pageSize') ?? '50', 10)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = db();

  const [profilesRes, authUsersRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id,display_name,tier,is_admin,early_access,onboarding_complete,created_at')
      .order('created_at', { ascending: false })
      .range(from, to),
    admin.schema('auth').from('users').select('id,email,last_sign_in_at'),
  ]);

  if (profilesRes.error) {
    return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });
  }

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const authUsers = (authUsersRes.data ?? []) as AuthUserRow[];

  const authMap = new Map(authUsers.map((u) => [u.id, u]));

  const users: AdminUserRecord[] = profiles.map((p) => {
    const auth = authMap.get(p.id);
    return {
      id: p.id,
      email: auth?.email ?? '',
      display_name: p.display_name,
      tier: p.tier,
      is_admin: p.is_admin,
      early_access: p.early_access,
      onboarding_complete: p.onboarding_complete,
      created_at: p.created_at,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
    };
  });

  return NextResponse.json({ users, page, pageSize });
}

export async function POST(request: NextRequest) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action: string; userId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, userId } = body;

  if (!action || !userId) {
    return NextResponse.json({ error: 'Missing action or userId' }, { status: 400 });
  }

  const admin = db();

  if (action === 'toggle_admin') {
    if (userId === adminUser.id) {
      return NextResponse.json({ error: 'Cannot change your own admin status' }, { status: 400 });
    }

    const { data: profile, error: fetchError } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent removing the last admin
    if (profile.is_admin) {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('is_admin', true);
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last admin account' }, { status: 400 });
      }
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({ is_admin: !profile.is_admin })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    void logAuditEvent({ actor_email: adminUser.email, actor_id: adminUser.id, action: 'user.toggle_admin', resource_type: 'user', resource_id: userId, metadata: { is_admin: !profile.is_admin }, severity: 'warning' });
    return NextResponse.json({ success: true, is_admin: !profile.is_admin });
  }

  if (action === 'reset_password') {
    // Fetch email from auth.users via service role
    const { data: authUserData, error: authFetchError } = await admin
      .schema('auth')
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (authFetchError || !authUserData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const email = (authUserData as { email: string }).email;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (linkError || !linkData) {
      return NextResponse.json({ error: linkError?.message ?? 'Failed to generate link' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action_link: linkData.properties?.action_link ?? null,
    });
  }

  if (action === 'toggle_early_access') {
    const { data: profile, error: fetchError } = await admin
      .from('profiles')
      .select('early_access')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update({ early_access: !profile.early_access })
      .eq('id', userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    void logAuditEvent({ actor_email: adminUser.email, actor_id: adminUser.id, action: 'user.toggle_early_access', resource_type: 'user', resource_id: userId, metadata: { early_access: !profile.early_access }, severity: 'info' });
    return NextResponse.json({ success: true, early_access: !profile.early_access });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
