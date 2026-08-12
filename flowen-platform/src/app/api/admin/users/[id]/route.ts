import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface AdminUserProfile {
  id: string;
  email: string;
  display_name: string | null;
  tier: string | null;
  is_admin: boolean;
  early_access: boolean;
  onboarding_complete: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  // practice stats
  total_sessions: number;
  total_duration_seconds: number;
  last_session_at: string | null;
  recent_sessions: {
    id: string;
    created_at: string;
    duration_seconds: number;
    stage_id: number | null;
    total_blocks_detected: number;
    total_repetitions_detected: number;
    total_prolongations_detected: number;
  }[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const client = serviceClient();

  const [profileRes, authRes, sessionsRes] = await Promise.all([
    client
      .from('profiles')
      .select('id,display_name,tier,is_admin,early_access,onboarding_complete,created_at')
      .eq('id', id)
      .single(),
    client.schema('auth').from('users').select('id,email,last_sign_in_at').eq('id', id).single(),
    client
      .from('practice_sessions')
      .select(
        'id,created_at,duration_seconds,stage_id,total_blocks_detected,total_repetitions_detected,total_prolongations_detected',
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const profile = profileRes.data;
  const auth = authRes.data;
  const sessions = (sessionsRes.data ?? []) as AdminUserProfile['recent_sessions'];

  const totalDuration = sessions.reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
  const lastSession = sessions[0]?.created_at ?? null;

  const result: AdminUserProfile = {
    id: profile.id,
    email: auth?.email ?? '',
    display_name: profile.display_name,
    tier: profile.tier,
    is_admin: profile.is_admin,
    early_access: profile.early_access,
    onboarding_complete: profile.onboarding_complete,
    created_at: profile.created_at,
    last_sign_in_at: auth?.last_sign_in_at ?? null,
    total_sessions: sessions.length,
    total_duration_seconds: totalDuration,
    last_session_at: lastSession,
    recent_sessions: sessions.slice(0, 10),
  };

  return NextResponse.json({ user: result });
}
