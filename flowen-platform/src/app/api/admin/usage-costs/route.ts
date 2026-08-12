import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/guard';

// ── Cost constants (estimates, clearly labelled in UI) ────────────────────────
// Based on: Deepgram Nova-2 ASR ~£0.0030/min, Claude Haiku inference ~£0.0020/session
export const ASR_COST_PER_MIN   = 0.003;   // £ per audio minute processed
export const AI_COST_PER_SESSION = 0.002;  // £ per session (phoneme analysis + feedback)
export const INFRA_MONTHLY_GBP  = 47.0;    // £ flat/month (Vercel Pro + Supabase base tier)

export function estimateUserCost(seconds: number, sessions: number): number {
  return (seconds / 60) * ASR_COST_PER_MIN + sessions * AI_COST_PER_SESSION;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserUsageRow {
  id:                 string;
  email:              string;
  displayName:        string | null;
  tier:               string | null;
  role:               string | null;
  joinedAt:           string;
  totalSessions:      number;
  sessionsMonth:      number;
  sessionsWeek:       number;
  sessionsToday:      number;
  totalSeconds:       number;
  secondsMonth:       number;
  lastSessionAt:      string | null;
  estimatedCostMonth: number;
}

export interface UsageCostsData {
  generatedAt:      string;
  // System totals
  totalUsers:       number;
  totalSessions:    number;
  sessionsToday:    number;
  sessionsWeek:     number;
  sessionsMonth:    number;
  totalSeconds:     number;
  secondsToday:     number;
  secondsWeek:      number;
  secondsMonth:     number;
  dau:              number;
  wau:              number;
  mau:              number;
  // Cost estimates (£)
  asrCostMonth:     number;
  aiCostMonth:      number;
  infraCostMonth:   number;
  totalCostMonth:   number;
  avgCostPerUser:   number;
  // Per-user
  users:            UserUsageRow[];
}

// ── DB ────────────────────────────────────────────────────────────────────────

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

export async function fetchUsageCosts(): Promise<UsageCostsData> {
  const db  = adminDb();
  const now = new Date();
  const todayStart    = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo       = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthAgo      = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [profilesRes, sessionsRes] = await Promise.all([
    db.from('profiles')
      .select('id, email, display_name, tier, role, created_at')
      .order('created_at', { ascending: false }),

    db.from('practice_sessions')
      .select('id, user_id, duration_seconds, created_at')
      .order('created_at', { ascending: false }),
  ]);

  const profiles  = profilesRes.data ?? [];
  const sessions  = sessionsRes.data ?? [];

  // System-wide aggregates
  const sessionsToday = sessions.filter(s => s.created_at >= todayStart).length;
  const sessionsWeek  = sessions.filter(s => s.created_at >= weekAgo).length;
  const sessionsMonth = sessions.filter(s => s.created_at >= monthAgo).length;

  const secondsToday  = sessions.filter(s => s.created_at >= todayStart).reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
  const secondsWeek   = sessions.filter(s => s.created_at >= weekAgo).reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
  const secondsMonth  = sessions.filter(s => s.created_at >= monthAgo).reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
  const totalSeconds  = sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);

  const dau = new Set(sessions.filter(s => s.created_at >= todayStart).map(s => s.user_id)).size;
  const wau = new Set(sessions.filter(s => s.created_at >= weekAgo).map(s => s.user_id)).size;
  const mau = new Set(sessions.filter(s => s.created_at >= monthAgo).map(s => s.user_id)).size;

  // Cost estimates
  const asrCostMonth   = (secondsMonth / 60) * ASR_COST_PER_MIN;
  const aiCostMonth    = sessionsMonth * AI_COST_PER_SESSION;
  const infraCostMonth = INFRA_MONTHLY_GBP;
  const totalCostMonth = asrCostMonth + aiCostMonth + infraCostMonth;
  const avgCostPerUser = mau > 0 ? totalCostMonth / mau : 0;

  // Per-user breakdown
  const byUser = new Map<string, { sessions: typeof sessions }>();
  for (const s of sessions) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, { sessions: [] });
    byUser.get(s.user_id)!.sessions.push(s);
  }

  const users: UserUsageRow[] = profiles.map(p => {
    const userSessions = byUser.get(p.id)?.sessions ?? [];
    const sessionsM   = userSessions.filter(s => s.created_at >= monthAgo);
    const secondsM    = sessionsM.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
    const sessionsW   = userSessions.filter(s => s.created_at >= weekAgo).length;
    const sessionsT   = userSessions.filter(s => s.created_at >= todayStart).length;
    const totalSecs   = userSessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
    const lastSession = userSessions[0]?.created_at ?? null;

    return {
      id:                 p.id,
      email:              p.email ?? '—',
      displayName:        p.display_name,
      tier:               p.tier,
      role:               p.role,
      joinedAt:           p.created_at,
      totalSessions:      userSessions.length,
      sessionsMonth:      sessionsM.length,
      sessionsWeek:       sessionsW,
      sessionsToday:      sessionsT,
      totalSeconds:       totalSecs,
      secondsMonth:       secondsM,
      lastSessionAt:      lastSession,
      estimatedCostMonth: estimateUserCost(secondsM, sessionsM.length),
    };
  });

  // Sort by total usage descending
  users.sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    generatedAt:    now.toISOString(),
    totalUsers:     profiles.length,
    totalSessions:  sessions.length,
    sessionsToday, sessionsWeek, sessionsMonth,
    totalSeconds, secondsToday, secondsWeek, secondsMonth,
    dau, wau, mau,
    asrCostMonth, aiCostMonth, infraCostMonth, totalCostMonth, avgCostPerUser,
    users,
  };
}

// ── GET /api/admin/usage-costs ─────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await fetchUsageCosts();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[usage-costs]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
