import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/guard';

// ── Cost registry ─────────────────────────────────────────────────────────────
// Fixed = real subscription prices (GBP, estimated from USD at 0.79)
// Variable = per-unit rates clearly labelled as estimates in the UI

export const SERVICES = [
  {
    id:       'vercel',
    name:     'Vercel',
    icon:     '▲',
    category: 'Hosting & CI/CD',
    billing:  'fixed' as const,
    monthlyGbp: 15.80,
    unit:     null,
    rate:     null,
    note:     'Pro plan — $20/mo',
    url:      'https://vercel.com',
  },
  {
    id:       'supabase',
    name:     'Supabase',
    icon:     '🗄',
    category: 'Database & Auth',
    billing:  'fixed' as const,
    monthlyGbp: 19.75,
    unit:     null,
    rate:     null,
    note:     'Pro plan — $25/mo (DB + Auth + Storage)',
    url:      'https://supabase.com',
  },
  {
    id:       'r2',
    name:     'Cloudflare R2',
    icon:     '🪣',
    category: 'Audio Storage',
    billing:  'variable' as const,
    monthlyGbp: 5.00,
    unit:     'GB/mo',
    rate:     0.015,
    note:     '10 GB free, then £0.015/GB — base £5/mo',
    url:      'https://cloudflare.com',
  },
  {
    id:       'asr',
    name:     'ASR Pipeline',
    icon:     '🎙',
    category: 'Speech Recognition',
    billing:  'variable' as const,
    monthlyGbp: 0,
    unit:     'audio min',
    rate:     0.003,
    note:     'Deepgram Nova-2 — ~£0.003/min',
    url:      'https://deepgram.com',
  },
  {
    id:       'ai',
    name:     'AI Inference',
    icon:     '🧠',
    category: 'Phoneme & Feedback',
    billing:  'variable' as const,
    monthlyGbp: 0,
    unit:     'session',
    rate:     0.002,
    note:     'Claude Haiku — ~£0.002/session',
    url:      'https://anthropic.com',
  },
  {
    id:       'stripe',
    name:     'Stripe',
    icon:     '💳',
    category: 'Payments',
    billing:  'variable' as const,
    monthlyGbp: 0,
    unit:     'transaction',
    rate:     null,
    note:     '1.5% + £0.20 per UK card charge',
    url:      'https://stripe.com',
  },
  {
    id:       'didit',
    name:     'DiDiT KYC',
    icon:     '🪪',
    category: 'Identity Verification',
    billing:  'variable' as const,
    monthlyGbp: 0,
    unit:     'verification',
    rate:     1.50,
    note:     '~£1.50 per identity check',
    url:      'https://didit.me',
  },
  {
    id:       'sentry',
    name:     'Sentry',
    icon:     '🐛',
    category: 'Error Monitoring',
    billing:  'freemium' as const,
    monthlyGbp: 0,
    unit:     null,
    rate:     null,
    note:     'Developer plan — free',
    url:      'https://sentry.io',
  },
  {
    id:       'posthog',
    name:     'PostHog',
    icon:     '📊',
    category: 'Product Analytics',
    billing:  'freemium' as const,
    monthlyGbp: 0,
    unit:     null,
    rate:     null,
    note:     'Free up to 1M events/mo',
    url:      'https://posthog.com',
  },
  {
    id:       'email',
    name:     'Resend',
    icon:     '📧',
    category: 'Transactional Email',
    billing:  'freemium' as const,
    monthlyGbp: 0,
    unit:     'email',
    rate:     0.001,
    note:     'Free 3,000/mo — £0.001 per email above',
    url:      'https://resend.com',
  },
] as const;

export type ServiceId = typeof SERVICES[number]['id'];

// Variable rate constants
export const ASR_PER_MIN     = 0.003;
export const AI_PER_SESSION  = 0.002;
export const STRIPE_PCT      = 0.015;
export const STRIPE_PER_TX   = 0.20;
export const KYC_PER_VERIFY  = 1.50;
export const EMAIL_FREE_TIER = 3_000;
export const EMAIL_OVERAGE   = 0.001;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceRow {
  id:              string;
  name:            string;
  icon:            string;
  category:        string;
  billing:         'fixed' | 'variable' | 'freemium';
  fixedGbp:        number;
  variableGbp:     number;
  totalGbp:        number;
  unit:            string | null;
  rate:            number | null;
  usage:           string | null;
  note:            string;
  url:             string;
}

export interface TierRow {
  tier:              string;
  users:             number;
  sessionsMonth:     number;
  secondsMonth:      number;
  revenueMonthPence: number;
  variableCostGbp:   number;
  fixedShareGbp:     number;
  pnlGbp:           number;
}

export interface UserPnL {
  id:                string;
  email:             string;
  displayName:       string | null;
  tier:              string | null;
  revenueMonthPence: number;
  variableCostGbp:   number;
  fixedShareGbp:     number;
  pnlGbp:           number;
  sessionsMonth:     number;
  secondsMonth:      number;
  sessionsTotal:     number;
  lastSessionAt:     string | null;
}

export interface UnitEconomics {
  mrr:                   number; // £
  arr:                   number; // £
  activeSubs:            number;
  arpu:                  number; // £/paying user
  ltv12:                 number; // 12-month LTV estimate
  avgVariableCostPerUser: number;
  grossMarginPct:        number;
  burnRateGbp:           number; // total costs - revenue (0 if revenue > costs)
  breakEvenUsers:        number;
  costPerSession:        number;
  revenuePerSession:     number;
}

export interface UsageCostsData {
  generatedAt:       string;
  // System totals
  totalUsers:        number;
  totalSessions:     number;
  sessionsToday:     number;
  sessionsWeek:      number;
  sessionsMonth:     number;
  totalSeconds:      number;
  secondsToday:      number;
  secondsWeek:       number;
  secondsMonth:      number;
  dau:               number;
  wau:               number;
  mau:               number;
  emailsSentMonth:   number;
  kycVerifiedTotal:  number;
  audioClipsTotal:   number;
  // Projections (end-of-month run-rate)
  projectedSessions: number;
  projectedSeconds:  number;
  // Services
  services:          ServiceRow[];
  // Cost totals
  totalFixedGbp:     number;
  totalVariableGbp:  number;
  totalCostGbp:      number;
  // Unit economics
  economics:         UnitEconomics;
  // Breakdowns
  tiers:             TierRow[];
  users:             UserPnL[];
}

// ── DB ────────────────────────────────────────────────────────────────────────

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Core fetch ────────────────────────────────────────────────────────────────

export async function fetchUsageCosts(): Promise<UsageCostsData> {
  const db  = adminDb();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo    = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const monthAgo   = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  // Day-of-month for projection
  const dayOfMonth   = now.getDate();
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projFactor   = daysInMonth / dayOfMonth;

  const [profilesRes, sessionsRes, subsRes, emailRes, telemetryRes] = await Promise.all([
    db.from('profiles')
      .select('id, email, display_name, tier, is_admin, id_verified, created_at'),

    db.from('practice_sessions')
      .select('id, user_id, duration_seconds, created_at')
      .order('created_at', { ascending: false }),

    db.from('subscriptions')
      .select('id, user_id, status, price_id, tier_interval')
      .eq('status', 'active'),

    db.from('notification_log')
      .select('id, sent_at')
      .gte('sent_at', monthAgo),

    db.from('telemetry_logs')
      .select('id', { count: 'exact', head: true }),
  ]);

  const profiles    = profilesRes.data   ?? [];
  const sessions    = sessionsRes.data   ?? [];
  const activeSubs  = subsRes.data       ?? [];
  const emailsMonth = emailRes.data      ?? [];
  const audioTotal  = telemetryRes.count ?? 0;

  // KYC count
  const kycVerifiedTotal = profiles.filter(p => p.id_verified).length;

  // System time-window aggregates
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

  // Projections
  const projectedSessions = dayOfMonth > 0 ? Math.round(sessionsMonth * projFactor) : sessionsMonth;
  const projectedSeconds  = dayOfMonth > 0 ? Math.round(secondsMonth * projFactor) : secondsMonth;

  // Revenue — try Stripe, fall back to subscription count estimate
  let mrrPence = 0;
  let activeSubCount = activeSubs.length;
  try {
    const { stripe } = await import('@/lib/stripe');
    const stripeSubs = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.items.data.price'],
    });
    activeSubCount = stripeSubs.data.length;
    for (const sub of stripeSubs.data) {
      const price = sub.items.data[0]?.price as { unit_amount: number | null; recurring: { interval: string; interval_count: number } | null } | undefined;
      if (!price) continue;
      const amount = price.unit_amount ?? 0;
      const interval = price.recurring?.interval ?? 'month';
      const count = price.recurring?.interval_count ?? 1;
      if (interval === 'year')  mrrPence += Math.round(amount / (count * 12));
      else if (interval === 'month') mrrPence += Math.round(amount / count);
    }
  } catch { /* Stripe unavailable — show 0 */ }

  const mrrGbp = mrrPence / 100;

  // Email overage
  const emailsSentMonth = emailsMonth.length;
  const emailOverage = Math.max(0, emailsSentMonth - 3000);

  // Audio storage estimate (120 KB per clip on average)
  const audioStorageGb = (audioTotal * 120) / (1024 * 1024);

  // Stripe fees (estimated from MRR: one charge per month per subscriber)
  const stripeFees = activeSubCount * STRIPE_PER_TX + mrrGbp * STRIPE_PCT;

  // Variable costs this month
  const asrCost   = (secondsMonth / 60) * ASR_PER_MIN;
  const aiCost    = sessionsMonth * AI_PER_SESSION;
  const kycCost   = kycVerifiedTotal * KYC_PER_VERIFY;
  const emailCost = emailOverage * EMAIL_OVERAGE;
  const r2Var     = Math.max(0, audioStorageGb - 10) * 0.015; // above 10 GB free

  const totalVariableGbp = asrCost + aiCost + stripeFees + kycCost + emailCost + r2Var;
  const totalFixedGbp    = SERVICES.filter(s => s.billing === 'fixed').reduce((a, s) => a + s.monthlyGbp, 0);
  const r2Fixed          = SERVICES.find(s => s.id === 'r2')?.monthlyGbp ?? 5;
  const totalCostGbp     = totalFixedGbp + r2Fixed + totalVariableGbp;

  // Gross margin
  const grossMarginPct  = mrrGbp > 0 ? Math.max(0, ((mrrGbp - totalVariableGbp) / mrrGbp) * 100) : 0;
  const netBurnRate     = Math.max(0, totalCostGbp - mrrGbp);
  const arpu            = activeSubCount > 0 ? mrrGbp / activeSubCount : 0;
  const avgVarPerUser   = mau > 0 ? totalVariableGbp / mau : 0;
  const breakEven       = (arpu - avgVarPerUser) > 0
    ? Math.ceil(totalFixedGbp / (arpu - avgVarPerUser))
    : 999;

  // Service rows (with actual computed variable amounts)
  const serviceRows: ServiceRow[] = SERVICES.map(svc => {
    let variableGbp = 0;
    let usageStr: string | null = null;
    switch (svc.id) {
      case 'asr':    variableGbp = asrCost;   usageStr = `${(secondsMonth / 60).toFixed(1)} min`;    break;
      case 'ai':     variableGbp = aiCost;    usageStr = `${sessionsMonth} sessions`;                  break;
      case 'stripe': variableGbp = stripeFees; usageStr = `${activeSubCount} active sub${activeSubCount !== 1 ? 's' : ''}`;   break;
      case 'didit':  variableGbp = kycCost;   usageStr = `${kycVerifiedTotal} verification${kycVerifiedTotal !== 1 ? 's' : ''}`; break;
      case 'email':  variableGbp = emailCost; usageStr = `${emailsSentMonth} sent (${emailOverage} over free)`; break;
      case 'r2':     variableGbp = r2Var;     usageStr = `${audioStorageGb.toFixed(3)} GB stored`;    break;
    }
    const fixedGbp = svc.billing === 'fixed' ? svc.monthlyGbp : svc.billing === 'variable' ? (svc.id === 'r2' ? 5 : 0) : 0;

    return {
      id:          svc.id,
      name:        svc.name,
      icon:        svc.icon,
      category:    svc.category,
      billing:     svc.billing,
      fixedGbp,
      variableGbp,
      totalGbp:    fixedGbp + variableGbp,
      unit:        svc.unit ?? null,
      rate:        svc.rate ?? null,
      usage:       usageStr,
      note:        svc.note,
      url:         svc.url,
    };
  });

  // Per-user sessions index
  const byUser = new Map<string, typeof sessions>();
  for (const s of sessions) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  // Revenue per user (from active subscriptions)
  const subByUser = new Map<string, number /* pence/mo */>();
  for (const sub of activeSubs) {
    subByUser.set(sub.user_id, mrrPence > 0 && activeSubCount > 0 ? Math.round(mrrPence / activeSubCount) : 0);
  }

  // Per-user P&L
  const fixedSharePerUser = profiles.length > 0 ? totalFixedGbp / profiles.length : 0;

  const users: UserPnL[] = profiles
    .map(p => {
      const userSessions = byUser.get(p.id) ?? [];
      const sMonth = userSessions.filter(s => s.created_at >= monthAgo);
      const secsM  = sMonth.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
      const varCost = (secsM / 60) * ASR_PER_MIN + sMonth.length * AI_PER_SESSION;
      const revPence = subByUser.get(p.id) ?? 0;
      const revGbp   = revPence / 100;

      return {
        id:                p.id,
        email:             p.email ?? '—',
        displayName:       p.display_name,
        tier:              p.tier,
        revenueMonthPence: revPence,
        variableCostGbp:   varCost,
        fixedShareGbp:     fixedSharePerUser,
        pnlGbp:           revGbp - varCost - fixedSharePerUser,
        sessionsMonth:     sMonth.length,
        secondsMonth:      secsM,
        sessionsTotal:     userSessions.length,
        lastSessionAt:     userSessions[0]?.created_at ?? null,
      };
    })
    .sort((a, b) => b.revenueMonthPence - a.revenueMonthPence || b.sessionsMonth - a.sessionsMonth);

  // Tier breakdown
  const tierMap = new Map<string, { users: number; sessionsMonth: number; secondsMonth: number; revPence: number; varCost: number }>();
  for (const p of profiles) {
    const tier = p.tier ?? 'standard';
    if (!tierMap.has(tier)) tierMap.set(tier, { users: 0, sessionsMonth: 0, secondsMonth: 0, revPence: 0, varCost: 0 });
    const row = tierMap.get(tier)!;
    row.users++;
    const userSessions = byUser.get(p.id) ?? [];
    const sMonth = userSessions.filter(s => s.created_at >= monthAgo);
    const secsM  = sMonth.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
    row.sessionsMonth += sMonth.length;
    row.secondsMonth  += secsM;
    row.revPence      += subByUser.get(p.id) ?? 0;
    row.varCost       += (secsM / 60) * ASR_PER_MIN + sMonth.length * AI_PER_SESSION;
  }

  const tiers: TierRow[] = Array.from(tierMap.entries()).map(([tier, row]) => ({
    tier,
    users:             row.users,
    sessionsMonth:     row.sessionsMonth,
    secondsMonth:      row.secondsMonth,
    revenueMonthPence: row.revPence,
    variableCostGbp:   row.varCost,
    fixedShareGbp:     row.users * fixedSharePerUser,
    pnlGbp:           (row.revPence / 100) - row.varCost - (row.users * fixedSharePerUser),
  })).sort((a, b) => b.revenueMonthPence - a.revenueMonthPence);

  return {
    generatedAt:    now.toISOString(),
    totalUsers:     profiles.length,
    totalSessions:  sessions.length,
    sessionsToday, sessionsWeek, sessionsMonth,
    totalSeconds, secondsToday, secondsWeek, secondsMonth,
    dau, wau, mau,
    emailsSentMonth,
    kycVerifiedTotal,
    audioClipsTotal: audioTotal,
    projectedSessions, projectedSeconds,
    services:       serviceRows,
    totalFixedGbp:  totalFixedGbp + r2Fixed,
    totalVariableGbp,
    totalCostGbp,
    economics: {
      mrr:                    mrrGbp,
      arr:                    mrrGbp * 12,
      activeSubs:             activeSubCount,
      arpu,
      ltv12:                  arpu * 12,
      avgVariableCostPerUser: avgVarPerUser,
      grossMarginPct,
      burnRateGbp:            netBurnRate,
      breakEvenUsers:         breakEven,
      costPerSession:         sessionsMonth > 0 ? totalVariableGbp / sessionsMonth : 0,
      revenuePerSession:      sessionsMonth > 0 ? mrrGbp / sessionsMonth : 0,
    },
    tiers,
    users,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const data = await fetchUsageCosts();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[usage-costs]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
