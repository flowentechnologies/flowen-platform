import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';

export interface AtRiskUser {
  id: string;
  display_name: string | null;
  created_at: string;
  tier: string | null;
  last_session_at: string | null;
}

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = adminDb();

  // Fetch onboarded users
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('id,display_name,created_at,tier')
    .eq('onboarding_complete', true);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ atRiskUsers: [] });
  }

  const profileIds = profiles.map((p: { id: string }) => p.id);

  // Fetch most recent practice session per user
  const { data: sessions, error: sessionsError } = await client
    .from('practice_sessions')
    .select('user_id,created_at')
    .in('user_id', profileIds)
    .order('created_at', { ascending: false });

  if (sessionsError) {
    return NextResponse.json({ error: sessionsError.message }, { status: 500 });
  }

  type SessionRow = { user_id: string; created_at: string };

  // Build map: userId -> most recent session date
  const lastSessionMap = new Map<string, string>();
  for (const s of ((sessions ?? []) as SessionRow[])) {
    if (!lastSessionMap.has(s.user_id)) {
      lastSessionMap.set(s.user_id, s.created_at);
    }
  }

  const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();

  type ProfileRow = { id: string; display_name: string | null; created_at: string; tier: string | null };

  // Filter: users with no sessions OR last session older than 14 days
  const atRisk: AtRiskUser[] = [];
  for (const p of (profiles as ProfileRow[])) {
    const lastSession = lastSessionMap.get(p.id) ?? null;
    if (lastSession === null || lastSession < cutoff) {
      atRisk.push({
        id: p.id,
        display_name: p.display_name,
        created_at: p.created_at,
        tier: p.tier,
        last_session_at: lastSession,
      });
    }
  }

  // Sort: nulls first (never practiced), then oldest session first
  atRisk.sort((a, b) => {
    if (a.last_session_at === null && b.last_session_at === null) return 0;
    if (a.last_session_at === null) return -1;
    if (b.last_session_at === null) return 1;
    return a.last_session_at < b.last_session_at ? -1 : 1;
  });

  return NextResponse.json({ atRiskUsers: atRisk.slice(0, 10) });
}
