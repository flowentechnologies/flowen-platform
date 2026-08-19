import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';

// ── Cost registry ─────────────────────────────────────────────────────────────
// Fixed    = real subscription/plan prices (GBP, USD converted at 0.79)
// Variable = per-unit rates labelled as estimates in the UI
// Freemium = free tier in normal use; rate shown for overage
//
// USD → GBP: multiply by 0.79

export const SERVICES = [
  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    id:         'vercel',
    name:       'Vercel',
    icon:       '▲',
    category:   'Hosting & CI/CD',
    billing:    'fixed' as const,
    monthlyGbp: 15.80,
    unit:       null,
    rate:       null,
    note:       'Pro plan — $20/mo. Includes unlimited deploys, preview URLs, edge network.',
    url:        'https://vercel.com',
  },
  {
    id:         'supabase',
    name:       'Supabase',
    icon:       '🗄',
    category:   'Database & Auth',
    billing:    'fixed' as const,
    monthlyGbp: 19.75,
    unit:       null,
    rate:       null,
    note:       'Pro plan — $25/mo. Covers Postgres DB, Auth, Storage, Edge Functions, Realtime.',
    url:        'https://supabase.com',
  },
  {
    id:         'r2',
    name:       'Cloudflare R2',
    icon:       '🪣',
    category:   'Training Audio Storage',
    billing:    'variable' as const,
    monthlyGbp: 0,
    unit:       'GB/mo',
    rate:       0.015,
    note:       '10 GB free, then ~£0.015/GB. Used for training-data bucket (user audio uploads).',
    url:        'https://cloudflare.com',
  },
  // ── AI & Speech ───────────────────────────────────────────────────────────
  {
    id:         'anthropic',
    name:       'Anthropic (Claude)',
    icon:       '🧠',
    category:   'AI Coaching',
    billing:    'variable' as const,
    monthlyGbp: 0,
    unit:       'session',
    rate:       0.0016,
    // Claude Haiku 4.5: input $0.80/M tokens, output $4/M tokens
    // Coaching prompt ≈ 800 input + 200 output tokens per session
    // Cost = (800×0.80 + 200×4) / 1_000_000 = £0.0016 @ 0.79
    note:       'Claude Haiku 4.5 — coaching feedback after each session. ~£0.0016/session.',
    url:        'https://anthropic.com',
  },
  {
    id:         'openai',
    name:       'OpenAI',
    icon:       '✦',
    category:   'ConvoAI LLM & TTS',
    billing:    'variable' as const,
    monthlyGbp: 0,
    unit:       'avatar min',
    rate:       0.0063,
    // GPT-4o-mini LLM: $0.15/M input + $0.60/M output @ ~500 tokens/turn, ~4 turns/min
    //   = $0.003/min = £0.0024/min
    // TTS-1 (fallback when no voice clone): $15/1M chars @ ~150 chars/turn × 4 turns/min
    //   = $0.009/min = £0.0071/min (worst-case; ElevenLabs used when clone exists)
    // Blended avg assuming 50% clone usage: ~£0.0063/avatar-minute
    note:       'GPT-4o-mini (ConvoAI LLM) + TTS-1 (fallback voice). ~£0.006/avatar-min.',
    url:        'https://platform.openai.com',
  },
  {
    id:         'elevenlabs',
    name:       'ElevenLabs',
    icon:       '🎙',
    category:   'Voice Cloning & TTS',
    billing:    'fixed' as const,
    monthlyGbp: 3.95,
    unit:       'char',
    rate:       0.00032,
    // Starter plan: $5/mo = 30k chars included; $0.40/1k chars above (£0.00032/char)
    // Includes Instant Voice Cloning. Turbo v2.5 model used for real-time avatar TTS.
    note:       'Starter plan — $5/mo (30k chars). £0.00032/char above. IVC for personalised voice.',
    url:        'https://elevenlabs.io',
  },
  {
    id:         'agora',
    name:       'Agora ConvoAI',
    icon:       '🔊',
    category:   'Real-time Audio & AI Avatar',
    billing:    'variable' as const,
    monthlyGbp: 0,
    unit:       'avatar min',
    rate:       0.0079,
    // ConvoAI RTC: $10/1k minutes = $0.01/min = £0.0079/min
    // Includes bidirectional audio + AI agent orchestration.
    note:       'ConvoAI RTC — $10/1k avatar-minutes (£0.008/min). Orchestrates LLM + TTS in real time.',
    url:        'https://agora.io',
  },
  {
    id:         'byteplus',
    name:       'BytePlus Ark (Seedance)',
    icon:       '🎬',
    category:   'Video Generation',
    billing:    'variable' as const,
    monthlyGbp: 0,
    unit:       'video',
    rate:       0.28,
    // Seedance 2.5 (16:9, 5s): ~$0.35/generation = £0.28. Admin-only — not per-user.
    note:       'Seedance 2.5 video gen — ~£0.28/clip (5 s, 16:9). Admin ad-asset generation only.',
    url:        'https://console.byteplus.com',
  },
  // ── Payments & Compliance ─────────────────────────────────────────────────
  {
    id:         'stripe',
    name:       'Stripe',
    icon:       '💳',
    category:   'Payments',
    billing:    'variable' as const,
    monthlyGbp: 0,
    unit:       'transaction',
    rate:       null,
    note:       '1.5% + £0.20 per UK card charge (European pricing). No monthly fee.',
    url:        'https://stripe.com',
  },
  {
    id:         'didit',
    name:       'DiDiT KYC',
    icon:       '🪪',
    category:   'Identity Verification',
    billing:    'variable' as const,
    monthlyGbp: 0,
    unit:       'verification',
    rate:       1.50,
    note:       '~£1.50 per identity check. One-off at onboarding for clinical pathway users.',
    url:        'https://didit.me',
  },
  // ── Observability & Comms ─────────────────────────────────────────────────
  {
    id:         'sentry',
    name:       'Sentry',
    icon:       '🐛',
    category:   'Error Monitoring',
    billing:    'freemium' as const,
    monthlyGbp: 0,
    unit:       null,
    rate:       null,
    note:       'Developer plan — free. 5k errors/mo, source maps, session replay.',
    url:        'https://sentry.io',
  },
  {
    id:         'posthog',
    name:       'PostHog',
    icon:       '📊',
    category:   'Product Analytics',
    billing:    'freemium' as const,
    monthlyGbp: 0,
    unit:       null,
    rate:       null,
    note:       'Free up to 1M events/mo. Includes funnels, heatmaps, session recording.',
    url:        'https://posthog.com',
  },
  {
    id:         'email',
    name:       'Resend',
    icon:       '📧',
    category:   'Transactional Email',
    billing:    'freemium' as const,
    monthlyGbp: 0,
    unit:       'email',
    rate:       0.001,
    note:       'Free 3,000/mo — £0.001 per email above. Used for auth, reports, onboarding.',
    url:        'https://resend.com',
  },
] as const;

export type ServiceId = typeof SERVICES[number]['id'];

// ── Variable rate constants ────────────────────────────────────────────────────
// USD → GBP at 0.79

// Anthropic: Haiku 4.5 — 800 input + 200 output tokens/session
export const AI_PER_SESSION      = 0.0016;  // £/session

// OpenAI: GPT-4o-mini LLM + TTS-1 blended (50% ElevenLabs clone usage)
export const OPENAI_PER_AVATAR_MIN = 0.0063; // £/avatar-minute

// ElevenLabs: chars above 30k free tier on Starter
export const EL_CHARS_FREE       = 30_000;
export const EL_CHAR_OVERAGE     = 0.00032; // £/char above free tier
export const EL_FIXED_GBP        = 3.95;    // Starter plan fixed cost

// Agora ConvoAI RTC
export const AGORA_PER_MIN        = 0.0079; // £/avatar-minute

// BytePlus Seedance (admin only, not per-user)
export const BYTEPLUS_PER_VIDEO   = 0.28;   // £/5-second clip

// Stripe
export const STRIPE_PCT           = 0.015;
export const STRIPE_PER_TX        = 0.20;

// DiDiT KYC
export const KYC_PER_VERIFY       = 1.50;

// Resend email
export const EMAIL_FREE_TIER      = 3_000;
export const EMAIL_OVERAGE        = 0.001;

// R2 Storage (Cloudflare)
export const R2_FREE_GB           = 10;
export const R2_PER_GB            = 0.015;

// Legacy: kept for backwards compatibility — not used directly
export const ASR_PER_MIN          = 0;      // Browser Web Speech API — free
export const AI_PER_SESSION_OLD   = AI_PER_SESSION;

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

// ── Compute & Infrastructure types ───────────────────────────────────────────

export interface TableSizeRow {
  name:   string;
  bytes:  number;
  pretty: string;
}

export interface ComputeData {
  // Vercel (from deployment config — region / runtime are real)
  vercelRegion:           string;
  nodeVersion:            string;
  functionMemoryMb:       number;
  functionTimeoutS:       number;
  functionTypes:          number;
  estimatedInvocationsMonth: number;
  estimatedBandwidthMb:   number;
  // Database (live from pg_database_size)
  dbBytes:                number;
  dbFreeTierLimitBytes:   number;
  dbTableCount:           number;
  dbUtilisationPct:       number;
  topTables:              TableSizeRow[];
  // Traffic (live from page_views table)
  pageViewsToday:         number;
  pageViewsWeek:          number;
  pageViewsMonth:         number;
  uniqueSessionsMonth:    number;
  // Cron jobs (live from cron_runs)
  cronTotalRuns:          number;
  cronSuccessful:         number;
  cronFailed:             number;
  cronSuccessRatePct:     number;
  cronAvgDurationMs:      number;
  cronMaxDurationMs:      number;
  cronLastRunAt:          string | null;
  cronDistinctJobs:       number;
  // ASR pipeline (from practice_sessions)
  audioTotalSeconds:      number;
  audioSessionCount:      number;
  avgSessionDurationS:    number;
  // Capacity limits (Supabase Pro tier)
  supabaseStorageLimitGb: number;
  supabaseAudioStorageGb: number;
  r2StorageGb:            number;
  r2FreeTierGb:           number;
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
  // Compute & infra
  compute:           ComputeData;
}

// ── DB ────────────────────────────────────────────────────────────────────────

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

  const [profilesRes, sessionsRes, subsRes, emailRes, telemetryRes,
         cronRes, pageViewRes, dbSizeRes, tableSizeRes] = await Promise.all([
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

    // Compute metrics via secure helper functions
    db.rpc('get_cron_summary'),
    db.rpc('get_pageview_summary'),
    db.rpc('get_db_size'),
    db.rpc('get_table_sizes'),
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
  // ASR: browser Web Speech API — no server cost
  const anthropicCost = sessionsMonth * AI_PER_SESSION;
  // Agora / OpenAI / ElevenLabs: estimate 30% of sessions use ConvoAI avatar @ avg 3 min/session
  const estimatedAvatarMinMonth = Math.round(sessionsMonth * 0.3 * 3);
  const agoraCost    = estimatedAvatarMinMonth * AGORA_PER_MIN;
  const openaiCost   = estimatedAvatarMinMonth * OPENAI_PER_AVATAR_MIN;
  // ElevenLabs: ~150 chars/turn × 4 turns per avatar session; first 30k chars free
  const elCharsMonth = sessionsMonth * 0.3 * 4 * 150;
  const elCharCost   = Math.max(0, elCharsMonth - EL_CHARS_FREE) * EL_CHAR_OVERAGE;
  const kycCost      = kycVerifiedTotal * KYC_PER_VERIFY;
  const emailCost    = emailOverage * EMAIL_OVERAGE;
  const r2Var        = Math.max(0, audioStorageGb - R2_FREE_GB) * R2_PER_GB;

  const totalVariableGbp = anthropicCost + openaiCost + agoraCost + elCharCost + stripeFees + kycCost + emailCost + r2Var;
  const totalFixedGbp    = SERVICES.filter(s => s.billing === 'fixed').reduce((a, s) => a + s.monthlyGbp, 0);
  const totalCostGbp     = totalFixedGbp + totalVariableGbp;

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
      case 'anthropic':  variableGbp = anthropicCost; usageStr = `${sessionsMonth} coaching sessions`; break;
      case 'openai':     variableGbp = openaiCost;    usageStr = `${estimatedAvatarMinMonth} avatar-min (est.)`; break;
      case 'agora':      variableGbp = agoraCost;     usageStr = `${estimatedAvatarMinMonth} avatar-min (est.)`; break;
      case 'elevenlabs': variableGbp = elCharCost;    usageStr = `${Math.round(elCharsMonth).toLocaleString()} chars (est.)`; break;
      case 'byteplus':   variableGbp = 0;             usageStr = `no videos generated this month`; break;
      case 'stripe':     variableGbp = stripeFees;    usageStr = `${activeSubCount} active sub${activeSubCount !== 1 ? 's' : ''}`; break;
      case 'didit':      variableGbp = kycCost;       usageStr = `${kycVerifiedTotal} verification${kycVerifiedTotal !== 1 ? 's' : ''}`; break;
      case 'email':      variableGbp = emailCost;     usageStr = `${emailsSentMonth} sent (${emailOverage} over free)`; break;
      case 'r2':         variableGbp = r2Var;         usageStr = `${audioStorageGb.toFixed(3)} GB stored`; break;
    }
    // Fixed services set monthlyGbp; pure-variable services use 0
    const fixedGbp = svc.monthlyGbp;

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
      const userAvatarMin = sMonth.length * 0.3 * 3;
      const varCost = sMonth.length * AI_PER_SESSION + userAvatarMin * (AGORA_PER_MIN + OPENAI_PER_AVATAR_MIN);
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
    const userAvatarMin = sMonth.length * 0.3 * 3;
    row.varCost       += sMonth.length * AI_PER_SESSION + userAvatarMin * (AGORA_PER_MIN + OPENAI_PER_AVATAR_MIN);
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

  // ── Compute & Infrastructure ─────────────────────────────────────────────
  const cron  = (cronRes.data     as Record<string,number|string|null> | null) ?? {};
  const pv    = (pageViewRes.data as Record<string,number> | null)             ?? {};
  const dbSz  = (dbSizeRes.data   as Record<string,number|string> | null)      ?? {};
  const tbls  = (tableSizeRes.data as TableSizeRow[] | null)                   ?? [];

  const cronTotal       = Number(cron.total           ?? 0);
  const cronSuccessful  = Number(cron.successful      ?? 0);
  const cronFailed      = Number(cron.failed          ?? 0);
  const cronAvgMs       = Number(cron.avg_duration_ms ?? 0);
  const cronMaxMs       = Number(cron.max_duration_ms ?? 0);
  const cronLastRun     = (cron.last_run_at as string | null) ?? null;
  const cronDistinct    = Number(cron.distinct_jobs   ?? 0);

  const pvToday         = Number(pv.today            ?? 0);
  const pvWeek          = Number(pv.week             ?? 0);
  const pvMonth         = Number(pv.month            ?? 0);
  const pvUnique        = Number(pv.unique_sessions  ?? 0);

  const dbBytes         = Number(dbSz.db_bytes ?? 16_428_179); // fallback to last known
  const DB_FREE_LIMIT   = 500 * 1024 * 1024; // 500 MB Supabase free tier
  const dbUtilPct       = (dbBytes / DB_FREE_LIMIT) * 100;
  const dbTableCount    = 70; // from schema (stable unless migrations run)

  // Bandwidth estimate: page views × ~150 KB avg page weight
  const estimatedBwMb   = Math.round((pvMonth * 150) / 1024);
  // Invocations estimate: each page view hits middleware + SSR function
  const estimatedInvoc  = Math.round(pvMonth * 2);

  // R2 audio storage (120 KB avg per clip)
  const r2StorageGb = (audioTotal * 120) / (1024 * 1024);

  const compute: ComputeData = {
    vercelRegion:             'iad1 (US East — Virginia)',
    nodeVersion:              'Node.js 24 LTS',
    functionMemoryMb:         1024,
    functionTimeoutS:         300,
    functionTypes:            3,
    estimatedInvocationsMonth: estimatedInvoc,
    estimatedBandwidthMb:     estimatedBwMb,
    dbBytes,
    dbFreeTierLimitBytes:     DB_FREE_LIMIT,
    dbTableCount,
    dbUtilisationPct:         dbUtilPct,
    topTables:                tbls.slice(0, 10),
    pageViewsToday:           pvToday,
    pageViewsWeek:            pvWeek,
    pageViewsMonth:           pvMonth,
    uniqueSessionsMonth:      pvUnique,
    cronTotalRuns:            cronTotal,
    cronSuccessful,
    cronFailed,
    cronSuccessRatePct:       cronTotal > 0 ? (cronSuccessful / cronTotal) * 100 : 100,
    cronAvgDurationMs:        cronAvgMs,
    cronMaxDurationMs:        cronMaxMs,
    cronLastRunAt:            cronLastRun,
    cronDistinctJobs:         cronDistinct,
    audioTotalSeconds:        totalSeconds,
    audioSessionCount:        sessions.length,
    avgSessionDurationS:      sessions.length > 0 ? totalSeconds / sessions.length : 0,
    supabaseStorageLimitGb:   1,
    supabaseAudioStorageGb:   r2StorageGb,
    r2StorageGb,
    r2FreeTierGb:             R2_FREE_GB,
  };

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
    totalFixedGbp,
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
    compute,
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
