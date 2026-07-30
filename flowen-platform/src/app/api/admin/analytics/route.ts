import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/guard';
import { stripe } from '@/lib/stripe';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function monthlyNormalisedPence(price: { unit_amount: number | null; recurring: { interval: string; interval_count: number } | null }): number {
  const amount = price.unit_amount ?? 0;
  const interval = price.recurring?.interval ?? 'month';
  const count = price.recurring?.interval_count ?? 1;
  if (interval === 'year')  return Math.round(amount / (count * 12));
  if (interval === 'month') return Math.round(amount / count);
  if (interval === 'week')  return Math.round((amount / count) * 52 / 12);
  if (interval === 'day')   return Math.round((amount / count) * 365 / 12);
  return amount;
}

export interface AnalyticsData {
  range: number;
  generatedAt: string;
  // Users
  totalUsers: number;
  onboarded: number;
  dau: number;
  wau: number;
  mau: number;
  dauMauRatio: string;
  // Revenue
  mrrPence: number;
  arrPence: number;
  activeSubs: number;
  trialingSubs: number;
  // Waitlist
  waitlistTotal: number;
  // Sessions
  totalSessions: number;
  sessionsInRange: number;
  avgDurationSeconds: number;
  avgBlocksDetected: number;
  avgRepsDetected: number;
  avgProlongDetected: number;
  practicedUsers: number;
  avgSessionsPerUser: string;
  // Trends
  signupsByDay: Record<string, number>;
  sessionsByDay: Record<string, number>;
  // Tiers
  tierCounts: Record<string, number>;
  // Growth (vs previous same-length period)
  newSignups: number;
  prevSignups: number;
  signupGrowthPct: number;
  newSessions: number;
  prevSessions: number;
  sessionGrowthPct: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('days') ?? '30'), 1), 365);

  const now    = new Date();
  const cutoff = new Date(now.getTime() - days * 86400_000);
  const prevCutoff = new Date(now.getTime() - 2 * days * 86400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const client = db();

  const [
    totalUsersRes,
    onboardedRes,
    waitlistRes,
    profilesInRangeRes,
    profilesPrevRes,
    tiersRes,
    sessionsInRangeRes,
    sessionsAllRes,
    sessionsActiveRes,   // for DAU/WAU/MAU
    sessionsPrevRes,
  ] = await Promise.all([
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('created_at').gte('created_at', cutoff.toISOString()),
    client.from('profiles').select('created_at').gte('created_at', prevCutoff.toISOString()).lt('created_at', cutoff.toISOString()),
    client.from('profiles').select('tier'),
    client.from('practice_sessions').select('user_id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at').gte('created_at', cutoff.toISOString()),
    client.from('practice_sessions').select('*', { count: 'exact', head: true }),
    // Fetch 90d window for DAU/WAU/MAU so we always have context even in 7d view
    client.from('practice_sessions').select('user_id,created_at').gte('created_at', new Date(now.getTime() - 90 * 86400_000).toISOString()),
    client.from('practice_sessions').select('*', { count: 'exact', head: true }).gte('created_at', prevCutoff.toISOString()).lt('created_at', cutoff.toISOString()),
  ]);

  // Revenue from Stripe
  let mrrPence = 0;
  let activeSubs = 0;
  let trialingSubs = 0;
  try {
    const stripeActive = await stripe.subscriptions.list({
      status: 'active', limit: 100,
      expand: ['data.items.data.price'],
    });
    const stripeTrialing = await stripe.subscriptions.list({
      status: 'trialing', limit: 100,
      expand: ['data.items.data.price'],
    });
    activeSubs = stripeActive.data.length;
    trialingSubs = stripeTrialing.data.length;
    for (const sub of stripeActive.data) {
      const price = sub.items.data[0]?.price;
      if (price) mrrPence += monthlyNormalisedPence(price as Parameters<typeof monthlyNormalisedPence>[0]);
    }
  } catch { /* Stripe unavailable — show zeros */ }

  // ── Compute ──────────────────────────────────────────────────────────────────

  type SessionRow = { user_id: string; duration_seconds: number; total_blocks_detected: number; total_repetitions_detected: number; total_prolongations_detected: number; created_at: string };
  type ActiveRow  = { user_id: string; created_at: string };

  const sessionsInRange = (sessionsInRangeRes.data ?? []) as SessionRow[];
  const sessionsActive  = (sessionsActiveRes.data  ?? []) as ActiveRow[];

  // DAU / WAU / MAU
  const dau = new Set(sessionsActive.filter(s => s.created_at >= todayStart.toISOString()).map(s => s.user_id)).size;
  const wau = new Set(sessionsActive.filter(s => s.created_at >= sevenDaysAgo.toISOString()).map(s => s.user_id)).size;
  const mau = new Set(sessionsActive.filter(s => s.created_at >= cutoff.toISOString()).map(s => s.user_id)).size;
  const dauMauRatio = mau > 0 ? ((dau / mau) * 100).toFixed(1) : '0.0';

  // Avg session metrics
  const n = sessionsInRange.length;
  const avgDurationSeconds  = n ? sessionsInRange.reduce((s, r) => s + r.duration_seconds, 0) / n : 0;
  const avgBlocksDetected   = n ? sessionsInRange.reduce((s, r) => s + r.total_blocks_detected, 0) / n : 0;
  const avgRepsDetected     = n ? sessionsInRange.reduce((s, r) => s + r.total_repetitions_detected, 0) / n : 0;
  const avgProlongDetected  = n ? sessionsInRange.reduce((s, r) => s + r.total_prolongations_detected, 0) / n : 0;
  const practicedUsers      = new Set(sessionsInRange.map(s => s.user_id)).size;
  const avgSessionsPerUser  = practicedUsers > 0 ? (n / practicedUsers).toFixed(1) : '0.0';

  // Trends by day
  const signupsByDay: Record<string, number> = {};
  for (const p of ((profilesInRangeRes.data ?? []) as { created_at: string }[])) {
    const day = p.created_at.slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  }
  const sessionsByDay: Record<string, number> = {};
  for (const s of sessionsInRange) {
    const day = s.created_at.slice(0, 10);
    sessionsByDay[day] = (sessionsByDay[day] ?? 0) + 1;
  }

  // Tier distribution
  const tierCounts: Record<string, number> = {};
  for (const p of ((tiersRes.data ?? []) as { tier: string | null }[])) {
    const t = p.tier ?? 'standard';
    tierCounts[t] = (tierCounts[t] ?? 0) + 1;
  }

  // Growth vs previous period
  const newSignups  = profilesInRangeRes.data?.length ?? 0;
  const prevSignups = profilesPrevRes.data?.length ?? 0;
  const signupGrowthPct = prevSignups > 0
    ? Math.round(((newSignups - prevSignups) / prevSignups) * 100)
    : newSignups > 0 ? 100 : 0;

  const newSessions  = n;
  const prevSessions = sessionsAllRes.count ?? 0; // re-use prev count query
  const sessionGrowthPct = (sessionsAllRes.count ?? 0) > 0
    ? Math.round(((newSessions - (sessionsAllRes.count ?? 0)) / (sessionsAllRes.count ?? 0)) * 100)
    : newSessions > 0 ? 100 : 0;

  const data: AnalyticsData = {
    range: days,
    generatedAt: now.toISOString(),
    totalUsers:   totalUsersRes.count ?? 0,
    onboarded:    onboardedRes.count  ?? 0,
    dau, wau, mau, dauMauRatio,
    mrrPence, arrPence: mrrPence * 12,
    activeSubs, trialingSubs,
    waitlistTotal: waitlistRes.count ?? 0,
    totalSessions: sessionsAllRes.count ?? 0,
    sessionsInRange: n,
    avgDurationSeconds, avgBlocksDetected, avgRepsDetected, avgProlongDetected,
    practicedUsers, avgSessionsPerUser,
    signupsByDay, sessionsByDay, tierCounts,
    newSignups, prevSignups, signupGrowthPct,
    newSessions, prevSessions: sessionsAllRes.count ?? 0, sessionGrowthPct,
  };

  return NextResponse.json(data);
}
