import { assertAdmin } from '@/lib/admin/guard';
import { SessionQualityClient } from './SessionQualityClient';
import type { SessionQualityData, UserProgress } from '@/app/api/admin/session-quality/route';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionRow = {
  id: string;
  user_id: string;
  duration_seconds: number;
  total_blocks_detected: number;
  total_repetitions_detected: number;
  total_prolongations_detected: number;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  display_name: string | null;
  tier: string | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function bpmForSession(s: SessionRow): number {
  if (s.duration_seconds <= 0) return 0;
  return s.total_blocks_detected / (s.duration_seconds / 60);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ── Data fetch ────────────────────────────────────────────────────────────────

async function fetchData(): Promise<SessionQualityData> {
  const client = db();
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86400_000);

  const [sessionsRes, profilesRes] = await Promise.all([
    client
      .from('practice_sessions')
      .select('id,user_id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at')
      .order('created_at', { ascending: true }),
    client
      .from('profiles')
      .select('id,email,display_name,tier,created_at'),
  ]);

  const allSessions = (sessionsRes.data ?? []) as SessionRow[];
  const allProfiles = (profilesRes.data ?? []) as ProfileRow[];

  // Group sessions by user
  const sessionsByUser = new Map<string, SessionRow[]>();
  for (const s of allSessions) {
    const existing = sessionsByUser.get(s.user_id) ?? [];
    existing.push(s);
    sessionsByUser.set(s.user_id, existing);
  }

  // Sessions in last 30 days
  const recentSessions = allSessions.filter(s => s.created_at >= cutoff30.toISOString());

  // sessionsByDay for sparkline
  const sessionsByDay: Record<string, number> = {};
  for (const s of recentSessions) {
    const day = s.created_at.slice(0, 10);
    sessionsByDay[day] = (sessionsByDay[day] ?? 0) + 1;
  }

  const activeUsersMonth = new Set(recentSessions.map(s => s.user_id)).size;

  const recentBpms = recentSessions.map(bpmForSession);
  const avgBlocksPerMin = avg(recentBpms);

  const avgDurationSeconds =
    recentSessions.length > 0
      ? avg(recentSessions.map(s => s.duration_seconds))
      : 0;

  const totalSessionsMonth = recentSessions.length;

  // Per-user progress
  const users: UserProgress[] = allProfiles.map(profile => {
    const userSessions = sessionsByUser.get(profile.id) ?? [];
    const sessionCount = userSessions.length;

    if (sessionCount === 0) {
      return {
        user_id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        tier: profile.tier,
        session_count: 0,
        first_session_at: null,
        last_session_at: null,
        avg_blocks_per_min: 0,
        baseline_bpm: null,
        recent_bpm: null,
        improvement_pct: null,
        trend: 'no_data' as const,
        total_practice_mins: 0,
        avg_duration_seconds: 0,
        signed_up_at: profile.created_at,
      };
    }

    const bpms = userSessions.map(bpmForSession);
    const avgBpm = avg(bpms);

    const first3 = userSessions.slice(0, 3);
    const last3  = userSessions.slice(-3);
    const baselineBpm = avg(first3.map(bpmForSession));
    const recentBpm   = avg(last3.map(bpmForSession));

    let improvementPct: number | null = null;
    let trend: UserProgress['trend'] = 'no_data';

    if (sessionCount >= 3) {
      improvementPct = baselineBpm !== 0
        ? ((recentBpm - baselineBpm) / baselineBpm) * 100
        : 0;
      if (improvementPct < -10) {
        trend = 'improving';
      } else if (improvementPct > 10) {
        trend = 'regressing';
      } else {
        trend = 'plateauing';
      }
    }

    const totalPracticeMins =
      userSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60;
    const avgDurSec =
      userSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / sessionCount;

    return {
      user_id: profile.id,
      email: profile.email,
      display_name: profile.display_name,
      tier: profile.tier,
      session_count: sessionCount,
      first_session_at: userSessions[0].created_at,
      last_session_at: userSessions[sessionCount - 1].created_at,
      avg_blocks_per_min: avgBpm,
      baseline_bpm: baselineBpm,
      recent_bpm: recentBpm,
      improvement_pct: improvementPct,
      trend,
      total_practice_mins: totalPracticeMins,
      avg_duration_seconds: avgDurSec,
      signed_up_at: profile.created_at,
    };
  });

  users.sort((a, b) => {
    if (a.session_count > 0 && b.session_count === 0) return -1;
    if (a.session_count === 0 && b.session_count > 0) return 1;
    if (a.session_count !== b.session_count) return b.session_count - a.session_count;
    if (a.last_session_at && b.last_session_at) {
      return b.last_session_at.localeCompare(a.last_session_at);
    }
    return 0;
  });

  let improvingCount = 0;
  let plateauingCount = 0;
  let regressingCount = 0;
  let noDataCount = 0;

  for (const u of users) {
    if (u.trend === 'improving')   improvingCount++;
    else if (u.trend === 'plateauing') plateauingCount++;
    else if (u.trend === 'regressing') regressingCount++;
    else noDataCount++;
  }

  const trendTotal = improvingCount + plateauingCount + regressingCount;
  const improvingPct = trendTotal > 0 ? (improvingCount / trendTotal) * 100 : 0;

  const usersWithSessions = users.filter(u => u.session_count > 0);
  const avgSessionsPerUser =
    usersWithSessions.length > 0
      ? usersWithSessions.reduce((sum, u) => sum + u.session_count, 0) /
        usersWithSessions.length
      : 0;

  let funnelNever = 0;
  let funnelTriedOnce = 0;
  let funnelOccasional = 0;
  let funnelRegular = 0;
  let funnelCommitted = 0;

  for (const u of users) {
    const n = u.session_count;
    if (n === 0) funnelNever++;
    else if (n === 1) funnelTriedOnce++;
    else if (n <= 4) funnelOccasional++;
    else if (n <= 9) funnelRegular++;
    else funnelCommitted++;
  }

  return {
    generatedAt: now.toISOString(),
    activeUsersMonth,
    avgBlocksPerMin,
    improvingPct,
    avgSessionsPerUser,
    avgDurationSeconds,
    totalSessionsMonth,
    improvingCount,
    plateauingCount,
    regressingCount,
    noDataCount,
    funnelNever,
    funnelTriedOnce,
    funnelOccasional,
    funnelRegular,
    funnelCommitted,
    sessionsByDay,
    users,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SessionQualityPage() {
  await assertAdmin();
  const data = await fetchData();
  return <SessionQualityClient initialData={data} />;
}
