import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Exported types ────────────────────────────────────────────────────────────

export interface WeeklyQualityPoint {
  week: string;          // ISO week label e.g. "W28"
  date: string;          // Monday of that week, ISO string
  sessions: number;
  avg_duration_seconds: number;
  avg_blocks_per_min: number;
  avg_repetitions_per_min: number;
  avg_prolongations_per_min: number;
  avg_total_disfluencies_per_min: number;
  unique_users: number;
}

export interface QualityData {
  weekly: WeeklyQualityPoint[];        // last 12 weeks
  overall_avg_blocks_per_min: number;
  overall_avg_duration_seconds: number;
  total_sessions_analysed: number;
  improving_users: number;             // users whose last 3 sessions avg < first 3 sessions avg (blocks/min)
  stable_users: number;
  declining_users: number;
  insufficient_data_users: number;     // fewer than 6 sessions total
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns ISO week number (1-based) for a date. */
function isoWeekNumber(date: Date): { year: number; week: number; monday: Date } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of the same week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  const year = d.getUTCFullYear();
  // Compute Monday of this week
  const orig = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const origDay = orig.getUTCDay() || 7;
  orig.setUTCDate(orig.getUTCDate() - (origDay - 1));
  return { year, week: weekNo, monday: orig };
}

function weekKey(date: Date): string {
  const { year, week } = isoWeekNumber(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function weekLabel(date: Date): string {
  const { week } = isoWeekNumber(date);
  return `W${week}`;
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 86400_000);

  const client = db();

  let rows: Array<{
    id: string;
    user_id: string;
    duration_seconds: number;
    total_blocks_detected: number;
    total_repetitions_detected: number;
    total_prolongations_detected: number;
    created_at: string;
  }> = [];

  try {
    const { data, error } = await client
      .from('practice_sessions')
      .select('id, user_id, duration_seconds, total_blocks_detected, total_repetitions_detected, total_prolongations_detected, created_at')
      .gte('created_at', twelveWeeksAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!error && data) {
      rows = data as typeof rows;
    }
  } catch {
    // Table missing or network error — return graceful empty
  }

  if (rows.length === 0) {
    const empty: QualityData = {
      weekly: [],
      overall_avg_blocks_per_min: 0,
      overall_avg_duration_seconds: 0,
      total_sessions_analysed: 0,
      improving_users: 0,
      stable_users: 0,
      declining_users: 0,
      insufficient_data_users: 0,
    };
    return NextResponse.json(empty);
  }

  // ── Per-session metrics ───────────────────────────────────────────────────

  type SessionMetric = {
    user_id: string;
    created_at: string;
    duration_seconds: number;
    blocks_per_min: number;
    reps_per_min: number;
    prolongations_per_min: number;
    total_per_min: number;
  };

  const validSessions: SessionMetric[] = [];

  for (const r of rows) {
    if (r.duration_seconds < 10) continue; // skip too-short sessions
    const mins = r.duration_seconds / 60;
    validSessions.push({
      user_id: r.user_id,
      created_at: r.created_at,
      duration_seconds: r.duration_seconds,
      blocks_per_min: r.total_blocks_detected / mins,
      reps_per_min: r.total_repetitions_detected / mins,
      prolongations_per_min: r.total_prolongations_detected / mins,
      total_per_min:
        (r.total_blocks_detected + r.total_repetitions_detected + r.total_prolongations_detected) / mins,
    });
  }

  // ── Group by ISO week ─────────────────────────────────────────────────────

  const weekMap = new Map<
    string,
    {
      label: string;
      monday: Date;
      sessions: SessionMetric[];
    }
  >();

  for (const s of validSessions) {
    const date = new Date(s.created_at);
    const key = weekKey(date);
    if (!weekMap.has(key)) {
      const { monday } = isoWeekNumber(date);
      weekMap.set(key, { label: weekLabel(date), monday, sessions: [] });
    }
    weekMap.get(key)!.sessions.push(s);
  }

  // Build sorted weekly array (last 12 weeks, ascending)
  const sortedKeys = Array.from(weekMap.keys()).sort();
  const weekly: WeeklyQualityPoint[] = sortedKeys.slice(-12).map((key) => {
    const { label, monday, sessions } = weekMap.get(key)!;
    const n = sessions.length;
    const avg = (fn: (s: SessionMetric) => number) =>
      n ? sessions.reduce((acc, s) => acc + fn(s), 0) / n : 0;

    return {
      week: label,
      date: monday.toISOString().slice(0, 10),
      sessions: n,
      avg_duration_seconds: avg((s) => s.duration_seconds),
      avg_blocks_per_min: avg((s) => s.blocks_per_min),
      avg_repetitions_per_min: avg((s) => s.reps_per_min),
      avg_prolongations_per_min: avg((s) => s.prolongations_per_min),
      avg_total_disfluencies_per_min: avg((s) => s.total_per_min),
      unique_users: new Set(sessions.map((s) => s.user_id)).size,
    };
  });

  // ── Overall averages ──────────────────────────────────────────────────────

  const totalN = validSessions.length;
  const overall_avg_blocks_per_min =
    totalN ? validSessions.reduce((a, s) => a + s.blocks_per_min, 0) / totalN : 0;
  const overall_avg_duration_seconds =
    totalN ? validSessions.reduce((a, s) => a + s.duration_seconds, 0) / totalN : 0;

  // ── User trajectory ───────────────────────────────────────────────────────

  // Group all valid sessions per user, sorted by created_at
  const byUser = new Map<string, SessionMetric[]>();
  for (const s of validSessions) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  let improving_users = 0;
  let stable_users = 0;
  let declining_users = 0;
  let insufficient_data_users = 0;

  for (const [, sessions] of byUser) {
    // Sort chronologically (already ordered but be safe)
    sessions.sort((a, b) => a.created_at.localeCompare(b.created_at));

    if (sessions.length < 6) {
      insufficient_data_users++;
      continue;
    }

    const first3 = sessions.slice(0, 3);
    const last3  = sessions.slice(-3);

    const avgFirst = first3.reduce((a, s) => a + s.blocks_per_min, 0) / 3;
    const avgLast  = last3.reduce((a, s) => a + s.blocks_per_min, 0) / 3;

    if (avgFirst === 0 && avgLast === 0) {
      stable_users++;
      continue;
    }

    const changePct = avgFirst > 0 ? (avgLast - avgFirst) / avgFirst : 0;

    if (changePct < -0.15) {
      improving_users++;      // blocks went DOWN >15% — improvement
    } else if (changePct > 0.15) {
      declining_users++;      // blocks went UP >15% — worse
    } else {
      stable_users++;
    }
  }

  const data: QualityData = {
    weekly,
    overall_avg_blocks_per_min,
    overall_avg_duration_seconds,
    total_sessions_analysed: totalN,
    improving_users,
    stable_users,
    declining_users,
    insufficient_data_users,
  };

  return NextResponse.json(data);
}
