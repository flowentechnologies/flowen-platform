import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { stripe } from '@/lib/stripe';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Exported types ────────────────────────────────────────────────────────────

export interface CohortRow {
  week: string;       // ISO week key: "YYYY-Www"
  label: string;      // Display label: "Wk 26"
  size: number;       // Number of users who signed up in this week
  retention: number[]; // 8 values (weeks 0–7), each 0–100
}

export interface ArrProjection {
  currentArr: number;       // pence
  threeMonth: number;       // pence
  sixMonth: number;         // pence
  twelveMonth: number;      // pence
  weeklyGrowthRate: number; // decimal, e.g. 0.05 = 5%
}

export interface CohortData {
  cohorts: CohortRow[];
  arrProjection: ArrProjection;
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an ISO week key like "2025-W26" for a given Date. */
function isoWeekKey(date: Date): string {
  // Copy date to avoid mutation
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (1=Mon, 7=Sun)
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Returns the Monday (start) of the ISO week for a given Date. */
function isoWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

/** Returns a short label like "Wk 26" from an ISO week key. */
function weekLabel(key: string): string {
  const match = key.match(/W(\d+)$/);
  return match ? `Wk ${parseInt(match[1], 10)}` : key;
}

function monthlyNormalisedPence(price: {
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number } | null;
}): number {
  const amount = price.unit_amount ?? 0;
  const interval = price.recurring?.interval ?? 'month';
  const count = price.recurring?.interval_count ?? 1;
  if (interval === 'year')  return Math.round(amount / (count * 12));
  if (interval === 'month') return Math.round(amount / count);
  if (interval === 'week')  return Math.round((amount / count) * 52 / 12);
  if (interval === 'day')   return Math.round((amount / count) * 365 / 12);
  return amount;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const eightWeeksAgo  = new Date(now.getTime() - 8  * 7 * 86400_000);
  const sixteenWeeksAgo = new Date(now.getTime() - 16 * 7 * 86400_000);

  const client = db();

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const [profilesRes, sessionsRes] = await Promise.all([
    client
      .from('profiles')
      .select('id,created_at')
      .gte('created_at', eightWeeksAgo.toISOString()),
    client
      .from('practice_sessions')
      .select('user_id,created_at')
      .gte('created_at', sixteenWeeksAgo.toISOString()),
  ]);

  type ProfileRow  = { id: string; created_at: string };
  type SessionRow  = { user_id: string; created_at: string };

  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const sessions  = (sessionsRes.data  ?? []) as SessionRow[];

  // ── Group profiles by signup week ───────────────────────────────────────────

  // weekKey -> { size, users: Set<id>, weekStart: Date }
  const cohortMap = new Map<string, { size: number; users: Set<string>; weekStart: Date }>();

  for (const p of profiles) {
    const d   = new Date(p.created_at);
    const key = isoWeekKey(d);
    if (!cohortMap.has(key)) {
      cohortMap.set(key, { size: 0, users: new Set(), weekStart: isoWeekStart(d) });
    }
    const entry = cohortMap.get(key)!;
    entry.size++;
    entry.users.add(p.id);
  }

  // ── Build a map: userId -> Set of ISO week keys they had sessions in ────────

  const userSessionWeeks = new Map<string, Set<string>>();
  for (const s of sessions) {
    const d   = new Date(s.created_at);
    const key = isoWeekKey(d);
    if (!userSessionWeeks.has(s.user_id)) {
      userSessionWeeks.set(s.user_id, new Set());
    }
    userSessionWeeks.get(s.user_id)!.add(key);
  }

  // ── Compute retention for each cohort ──────────────────────────────────────

  const RETENTION_WEEKS = 8;

  const cohorts: CohortRow[] = [];

  // Sort keys most-recent-first
  const sortedKeys = [...cohortMap.keys()].sort((a, b) => (a < b ? 1 : -1));

  for (const key of sortedKeys) {
    const { size, users, weekStart } = cohortMap.get(key)!;
    if (size === 0) continue;

    const retention: number[] = [];

    for (let wOffset = 0; wOffset < RETENTION_WEEKS; wOffset++) {
      // The target week starts wOffset * 7 days after the cohort week start
      const targetWeekStart = new Date(weekStart.getTime() + wOffset * 7 * 86400_000);
      const targetKey = isoWeekKey(targetWeekStart);

      // Future weeks — not enough data yet, mark as -1 sentinel (we'll treat as null)
      if (targetWeekStart > now) {
        retention.push(-1);
        continue;
      }

      // Count how many cohort users had at least one session in that week
      let active = 0;
      for (const userId of users) {
        const weeks = userSessionWeeks.get(userId);
        if (weeks?.has(targetKey)) active++;
      }

      retention.push(Math.round((active / size) * 100));
    }

    cohorts.push({ week: key, label: weekLabel(key), size, retention });
  }

  // ── ARR projection ──────────────────────────────────────────────────────────

  let mrrPence = 0;
  let weeklyGrowthRate = 0;

  try {
    const fourWeeksAgo = new Date(now.getTime() - 4 * 7 * 86400_000);

    const [stripeActive, stripeRecent] = await Promise.all([
      stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] }),
      // Fetch all active subs to compute weekly new subscriber rate from created timestamps
      stripe.subscriptions.list({ status: 'active', limit: 100, created: { gte: Math.floor(fourWeeksAgo.getTime() / 1000) } }),
    ]);

    // Current MRR
    for (const sub of stripeActive.data) {
      const price = sub.items.data[0]?.price;
      if (price) {
        mrrPence += monthlyNormalisedPence(price as Parameters<typeof monthlyNormalisedPence>[0]);
      }
    }

    // Weekly new subscriber count over last 4 weeks
    const weekCounts: number[] = [0, 0, 0, 0]; // week 0 = most recent
    for (const sub of stripeRecent.data) {
      const createdAt = new Date((sub.created as number) * 1000);
      const msAgo = now.getTime() - createdAt.getTime();
      const weekIndex = Math.floor(msAgo / (7 * 86400_000));
      if (weekIndex >= 0 && weekIndex < 4) {
        weekCounts[weekIndex]++;
      }
    }

    const totalNewSubs = weekCounts.reduce((s, c) => s + c, 0);
    const avgNewSubsPerWeek = totalNewSubs / 4;

    // Growth rate = new subs / existing subs (simple approximation)
    const totalActiveSubs = stripeActive.data.length;
    weeklyGrowthRate = totalActiveSubs > 0 ? avgNewSubsPerWeek / totalActiveSubs : 0;
  } catch {
    // Stripe unavailable — zeros
  }

  const currentArr = mrrPence * 12;

  // Compound growth: currentARR * (1 + weeklyGrowthRate)^weeks
  const threeMonthWeeks  = 13;
  const sixMonthWeeks    = 26;
  const twelveMonthWeeks = 52;

  function project(weeks: number): number {
    return Math.round(currentArr * Math.pow(1 + weeklyGrowthRate, weeks));
  }

  const arrProjection: ArrProjection = {
    currentArr,
    threeMonth:  currentArr > 0 ? project(threeMonthWeeks)  : 0,
    sixMonth:    currentArr > 0 ? project(sixMonthWeeks)    : 0,
    twelveMonth: currentArr > 0 ? project(twelveMonthWeeks) : 0,
    weeklyGrowthRate,
  };

  const responseData: CohortData = {
    cohorts,
    arrProjection,
    generatedAt: now.toISOString(),
  };

  return NextResponse.json(responseData);
}
