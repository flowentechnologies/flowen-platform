import { assertAdmin } from '@/lib/admin/guard';
import { stripe } from '@/lib/stripe';
import { AnalyticsClient } from './AnalyticsClient';
import type { AnalyticsData } from '@/app/api/admin/analytics/route';
import { adminDb as db } from '@/lib/supabase/admin';

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

export default async function AnalyticsPage() {
  await assertAdmin();

  const now        = new Date();
  const days       = 30;
  const cutoff     = new Date(now.getTime() - days * 86400_000);
  const prevCutoff = new Date(now.getTime() - 2 * days * 86400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const client = db();

  const [
    totalUsersRes, onboardedRes, waitlistRes,
    profilesInRangeRes, profilesPrevRes, tiersRes,
    sessionsInRangeRes, sessionsAllRes, sessionsActiveRes, sessionsPrevRes,
  ] = await Promise.all([
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('created_at').gte('created_at', cutoff.toISOString()),
    client.from('profiles').select('created_at').gte('created_at', prevCutoff.toISOString()).lt('created_at', cutoff.toISOString()),
    client.from('profiles').select('tier'),
    client.from('practice_sessions').select('user_id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at').gte('created_at', cutoff.toISOString()),
    client.from('practice_sessions').select('*', { count: 'exact', head: true }),
    client.from('practice_sessions').select('user_id,created_at').gte('created_at', new Date(now.getTime() - 90 * 86400_000).toISOString()),
    client.from('practice_sessions').select('*', { count: 'exact', head: true }).gte('created_at', prevCutoff.toISOString()).lt('created_at', cutoff.toISOString()),
  ]);

  let mrrPence = 0, activeSubs = 0, trialingSubs = 0;
  try {
    const [stripeActive, stripeTrialing] = await Promise.all([
      stripe.subscriptions.list({ status: 'active',   limit: 100, expand: ['data.items.data.price'] }),
      stripe.subscriptions.list({ status: 'trialing', limit: 100, expand: ['data.items.data.price'] }),
    ]);
    activeSubs   = stripeActive.data.length;
    trialingSubs = stripeTrialing.data.length;
    for (const sub of stripeActive.data) {
      const price = sub.items.data[0]?.price;
      if (price) mrrPence += monthlyNormalisedPence(price as Parameters<typeof monthlyNormalisedPence>[0]);
    }
  } catch { /* Stripe unavailable — show zeros */ }

  type SessionRow = { user_id: string; duration_seconds: number; total_blocks_detected: number; total_repetitions_detected: number; total_prolongations_detected: number; created_at: string };
  type ActiveRow  = { user_id: string; created_at: string };

  const sessionsInRange = (sessionsInRangeRes.data ?? []) as SessionRow[];
  const sessionsActive  = (sessionsActiveRes.data  ?? []) as ActiveRow[];
  const n = sessionsInRange.length;

  const dau = new Set(sessionsActive.filter(s => s.created_at >= todayStart.toISOString()).map(s => s.user_id)).size;
  const wau = new Set(sessionsActive.filter(s => s.created_at >= sevenDaysAgo.toISOString()).map(s => s.user_id)).size;
  const mau = new Set(sessionsActive.filter(s => s.created_at >= cutoff.toISOString()).map(s => s.user_id)).size;

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
  const tierCounts: Record<string, number> = {};
  for (const p of ((tiersRes.data ?? []) as { tier: string | null }[])) {
    const t = p.tier ?? 'standard';
    tierCounts[t] = (tierCounts[t] ?? 0) + 1;
  }

  const newSignups     = profilesInRangeRes.data?.length ?? 0;
  const prevSignups    = profilesPrevRes.data?.length ?? 0;
  const practicedUsers = new Set(sessionsInRange.map(s => s.user_id)).size;

  const initialData: AnalyticsData = {
    range: days,
    generatedAt: now.toISOString(),
    totalUsers: totalUsersRes.count ?? 0,
    onboarded:  onboardedRes.count  ?? 0,
    dau, wau, mau,
    dauMauRatio: mau > 0 ? ((dau / mau) * 100).toFixed(1) : '0.0',
    mrrPence, arrPence: mrrPence * 12,
    activeSubs, trialingSubs,
    waitlistTotal:   waitlistRes.count ?? 0,
    totalSessions:   sessionsAllRes.count ?? 0,
    sessionsInRange: n,
    avgDurationSeconds: n ? sessionsInRange.reduce((s, r) => s + r.duration_seconds, 0) / n : 0,
    avgBlocksDetected:  n ? sessionsInRange.reduce((s, r) => s + r.total_blocks_detected, 0) / n : 0,
    avgRepsDetected:    n ? sessionsInRange.reduce((s, r) => s + r.total_repetitions_detected, 0) / n : 0,
    avgProlongDetected: n ? sessionsInRange.reduce((s, r) => s + r.total_prolongations_detected, 0) / n : 0,
    practicedUsers,
    avgSessionsPerUser: practicedUsers > 0 ? (n / practicedUsers).toFixed(1) : '0.0',
    signupsByDay, sessionsByDay, tierCounts,
    newSignups, prevSignups,
    signupGrowthPct: prevSignups > 0
      ? Math.round(((newSignups - prevSignups) / prevSignups) * 100)
      : newSignups > 0 ? 100 : 0,
    newSessions: n,
    prevSessions: sessionsPrevRes.count ?? 0,
    sessionGrowthPct: 0,
  };

  return <AnalyticsClient initialData={initialData} />;
}
