'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import type { ProgrammeState } from '@/lib/programme';
import { GettingStartedChecklist, type ChecklistState } from '@/components/dashboard/GettingStartedChecklist';
import { DashboardTour } from '@/components/dashboard/DashboardTour';

type Trend = 'improving' | 'plateauing' | 'regressing' | 'no_data';

export type SubscriptionInfo = {
  status:            string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd:  string | null;
};

const TIER_LABELS: Record<string, string> = {
  founding:        'Founding Member',
  standard:        'Standard',
  public_funds:    'Public Funds',
  vocali_freemium: 'Freemium',
};

const STAGE_NAMES: Record<number, string> = {
  1: 'Breathing',
  2: 'Easy Onset',
  3: 'Light Contacts',
  4: 'Pausing',
  5: 'Conversation',
};

type RecentSession = {
  id: string;
  created_at: string;
  duration_seconds: number;
  total_blocks_detected: number;
  stage_id: number | null;
  bpm: number;
};

interface DashboardClientProps {
  serverDate: string;
  greeting: string;
  displayName: string;
  tier: string | null;
  subscriptionInfo: SubscriptionInfo;
  sessionCount: number;
  totalMins: number;
  streak: number;
  trend: Trend;
  improvementPct: number | null;
  sessionsByDay: Record<string, number>;
  recentBpms: number[];
  recentSessions: RecentSession[];
  programmeState: ProgrammeState | null;
  checklistState: ChecklistState;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function bpmColor(bpm: number): string {
  if (bpm < 2) return 'text-emerald-600 dark:text-emerald-400';
  if (bpm <= 5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// Builds an array of the last 30 calendar days, oldest first.
// Accepts the request-time Date so SSR and hydration agree on the same anchor.
function buildLast30Days(now: Date): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

// ─── Plan Banner ─────────────────────────────────────────────────────────────

const LOCKED_FEATURES = [
  'Unlimited practice sessions',
  'Full fluency analytics & trend tracking',
  'Personalised 8-week programme',
  'SLT-ready progress reports',
  'Priority AI coach feedback',
];

function PlanBanner({ tier, sub }: { tier: string | null; sub: SubscriptionInfo }) {
  const isPastDue = sub.status === 'past_due' || sub.status === 'unpaid';
  const isIncomplete = sub.status === 'incomplete';
  const isCancelling = sub.cancelAtPeriodEnd && sub.status === 'active';
  const periodEndLabel = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // ── 1. OVERDUE / PAST DUE ── highest priority, always shown regardless of tier
  if (isPastDue || isIncomplete) {
    return (
      <div className="rounded-2xl border-2 border-red-500/60 bg-red-500/10 px-5 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold text-red-600 dark:text-red-400 leading-snug">
                Payment failed — action required
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Your subscription payment didn&apos;t go through. Please update your payment method to keep access to Flowen.
                {periodEndLabel && ` Access ends ${periodEndLabel} if not resolved.`}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/billing"
            className="shrink-0 px-5 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-colors whitespace-nowrap shadow-lg shadow-red-500/25"
          >
            Pay now →
          </Link>
        </div>
      </div>
    );
  }

  // ── 2. CANCELLING ── show retention nudge before access ends
  if (isCancelling) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/8 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                Your plan cancels {periodEndLabel ? `on ${periodEndLabel}` : 'soon'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reactivate to keep your progress, analytics, and programme access.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard/billing" className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors whitespace-nowrap">
              Reactivate →
            </Link>
            <Link href="/dashboard/billing" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors whitespace-nowrap">
              Manage billing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 3. FOUNDING / PUBLIC FUNDS ── affirm + surface billing link
  if (tier === 'founding' || tier === 'public_funds') {
    return (
      <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/8 to-emerald-500/5 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-violet-500 dark:text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {tier === 'founding' ? 'Founding Member' : 'Public Funds Access'}{' '}
                <span className="text-violet-500 dark:text-violet-400 text-[10px] font-mono ml-1 uppercase tracking-widest">Full access</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {tier === 'founding'
                  ? 'Thank you for believing in Flowen from the start. All features are unlocked.'
                  : 'Your access is funded. All premium features are unlocked.'}
              </p>
            </div>
          </div>
          <Link href="/dashboard/billing" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0 whitespace-nowrap">
            Billing →
          </Link>
        </div>
      </div>
    );
  }

  // ── 4. ACTIVE STANDARD ── affirm + upsell Access to Work
  if (tier === 'standard' && sub.status === 'active') {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
              Standard Access <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-mono ml-1">ACTIVE</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Employed? Access to Work can reimburse your subscription — you pay nothing.{' '}
              <Link href="/resources/access-to-work" className="text-emerald-600 dark:text-emerald-400 hover:underline">Learn more →</Link>
            </p>
          </div>
        </div>
        <Link href="/dashboard/billing" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors shrink-0 whitespace-nowrap">
          Manage billing →
        </Link>
      </div>
    );
  }

  // ── 5. FREE / NO SUBSCRIPTION ── maximum-conversion upgrade card
  return (
    <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 px-6 py-6 space-y-5 shadow-xl shadow-emerald-500/5">
      {/* Headline */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
              Upgrade
            </span>
          </div>
          <h2 className="text-lg font-bold text-white leading-snug">
            Unlock everything — from <span className="text-emerald-400">£19.96/mo</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            You&apos;re on the free plan. Upgrade for unlimited sessions, full analytics, and your personalised programme.
          </p>
        </div>
        {/* Primary CTA */}
        <div className="shrink-0 flex flex-col gap-2">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 whitespace-nowrap"
          >
            Upgrade now →
          </Link>
          <Link
            href="/resources/access-to-work"
            className="text-center text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
          >
            Get it funded via Access to Work ↗
          </Link>
        </div>
      </div>

      {/* Feature list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {LOCKED_FEATURES.map((f) => (
          <div key={f} className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd"/>
            </svg>
            <span className="text-slate-300 text-xs">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  valueClass = 'text-slate-900 dark:text-white',
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">
        {label}
      </span>
      <span className={`text-3xl font-bold leading-none ${valueClass}`}>
        {value}
      </span>
      <span className="text-slate-500 dark:text-slate-400 text-xs">{sub}</span>
    </div>
  );
}

const PHASE_COLORS: Record<string, string> = {
  Foundation:  'text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/10',
  Building:    'text-violet-600 dark:text-violet-400 border-violet-500/30 bg-violet-500/10',
  Integration: 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10',
  Transfer:    'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  Maintenance: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
};

function ProgrammeCard({ state }: { state: ProgrammeState }) {
  const [advancing, setAdvancing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [localState, setLocalState] = useState<ProgrammeState>(state);
  const s = localState;
  const phaseColor = PHASE_COLORS[s.week.phase] ?? 'text-slate-500 dark:text-slate-400 border-slate-600/30 bg-slate-700/20';
  const isLastWeek = s.currentWeek >= 8;

  const handleAdvanceClick = () => {
    if (!confirm) {
      setConfirm(true);
      setTimeout(() => setConfirm(false), 4000);
      return;
    }
    setConfirm(false);
    doAdvance();
  };

  const doAdvance = async () => {
    setAdvancing(true);
    setAdvanceError(null);
    try {
      const res = await fetch('/api/user/programme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance' }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setAdvanceError(json.error ?? 'Something went wrong. Try again.');
        return;
      }
      const next = await res.json() as ProgrammeState;
      setLocalState(next);
    } catch {
      setAdvanceError('Network error. Check your connection and try again.');
    } finally {
      setAdvancing(false);
    }
  };

  if (s.isComplete) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 shrink-0">
            <svg viewBox="0 0 20 20" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-slate-900 dark:text-white font-bold">8-Week Programme Complete</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">You've worked through every stage. Keep practising to maintain your gains.</p>
          </div>
        </div>
        <Link href="/dashboard/practice" className="inline-block px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors">
          Continue practising →
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">8-Week Programme</p>
          <p className="text-slate-900 dark:text-white font-bold text-lg mt-0.5">Week {s.currentWeek} — {s.week.title}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${phaseColor}`}>
          {s.week.phase}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span>Week {s.currentWeek} of 8</span>
          <span>{s.progressPct}% complete</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${s.progressPct}%` }} />
        </div>
      </div>

      {/* This week target */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500">Sessions this week</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            <span className={s.sessionsThisWeek >= s.week.targetSessions ? 'text-emerald-600 dark:text-emerald-400' : ''}>{s.sessionsThisWeek}</span>
            <span className="text-slate-400 dark:text-slate-600 text-sm font-normal"> / {s.week.targetSessions}</span>
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500">Target per session</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{s.week.targetMinutes}<span className="text-slate-400 dark:text-slate-600 text-sm font-normal"> min</span></p>
        </div>
      </div>

      {/* Focus tip */}
      <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed border-l-2 border-slate-200 dark:border-slate-700 pl-3">
        <span className="text-slate-700 dark:text-slate-300 font-semibold">This week: </span>{s.week.focus}
      </p>

      {/* Actions */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/dashboard/practice"
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
          >
            Start session →
          </Link>
          {s.canAdvance && (
            <button
              onClick={handleAdvanceClick}
              disabled={advancing}
              className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                confirm
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {advancing
                ? 'Advancing…'
                : confirm
                ? 'Confirm — click again'
                : isLastWeek
                ? 'Complete programme →'
                : `Advance to week ${s.currentWeek + 1} →`}
            </button>
          )}
        </div>
        {s.canAdvance && !advancing && (
          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-mono">
            {confirm
              ? 'This will lock you into the next week. Sessions reset.'
              : "You've met this week's target — advance when ready or keep practising."}
          </p>
        )}
        {advanceError && (
          <p className="text-xs text-red-500 dark:text-red-400 font-mono">{advanceError}</p>
        )}
      </div>
    </div>
  );
}

export function DashboardClient({
  serverDate,
  greeting,
  displayName,
  tier,
  subscriptionInfo,
  sessionCount,
  totalMins,
  streak,
  trend,
  improvementPct,
  sessionsByDay,
  recentBpms,
  recentSessions,
  programmeState,
  checklistState,
}: DashboardClientProps) {
  // Parse the server-computed timestamp once so SSR and hydration use the same anchor,
  // avoiding text-node mismatches (React error #418) from date/time differences.
  const now = useMemo(() => new Date(serverDate), [serverDate]);
  const days30 = useMemo(() => buildLast30Days(now), [now]);
  const todayKey = serverDate.slice(0, 10);
  const totalActivitySessions = Object.values(sessionsByDay).reduce(
    (a, b) => a + b,
    0
  );

  // Trend KPI
  let trendValue = '—';
  let trendSub = 'need 3+ sessions';
  let trendClass = 'text-slate-400 dark:text-slate-500';
  if (trend === 'improving' && improvementPct !== null) {
    trendValue = `down ${Math.abs(improvementPct)}%`;
    trendSub = 'fewer blocks/min';
    trendClass = 'text-emerald-600 dark:text-emerald-400';
  } else if (trend === 'regressing' && improvementPct !== null) {
    trendValue = `up ${improvementPct}%`;
    trendSub = 'blocks increasing';
    trendClass = 'text-red-600 dark:text-red-400';
  } else if (trend === 'plateauing') {
    trendValue = 'stable';
    trendSub = 'holding steady';
    trendClass = 'text-amber-600 dark:text-amber-400';
  }

  const activityMax = Math.max(1, ...Object.values(sessionsByDay));
  const bpmMax = Math.max(1, ...recentBpms);

  function bpmBarColor(bpm: number): string {
    if (bpm < 2) return 'bg-emerald-500';
    if (bpm <= 5) return 'bg-amber-500';
    return 'bg-red-500';
  }

  const latestBpm =
    recentBpms.length > 0 ? recentBpms[recentBpms.length - 1] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* First-run interactive guide */}
      <DashboardTour />

      {/* A. Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Good {greeting}, {displayName}.
          </h1>
          {tier && (
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              {TIER_LABELS[tier] ?? tier}
            </span>
          )}
        </div>
        <Link
          data-tour="practice-btn"
          href="/dashboard/practice"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-colors shrink-0"
        >
          Start Practice
          <span aria-hidden>&#8594;</span>
        </Link>
      </div>

      {/* B. Plan banner */}
      <PlanBanner tier={tier} sub={subscriptionInfo} />

      {/* B2. Getting started checklist — shown until all 5 tasks complete */}
      <div data-tour="checklist">
        <GettingStartedChecklist state={checklistState} tier={tier} />
      </div>

      {/* C0. Today card — streak + daily target */}
      {sessionCount > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* Streak flame */}
              <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl border shrink-0 ${
                streak > 0
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}>
                <span className="text-xl leading-none">{streak > 0 ? '🔥' : '💤'}</span>
                <span className={`text-[11px] font-bold font-mono tabular-nums mt-0.5 ${
                  streak > 0 ? 'text-orange-500' : 'text-slate-500'
                }`}>{streak}d</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {(sessionsByDay[todayKey] ?? 0) > 0
                    ? "Today's session done ✓"
                    : streak > 0
                    ? `Keep your ${streak}-day streak alive`
                    : 'Start your practice streak'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(sessionsByDay[todayKey] ?? 0) > 0
                    ? `${sessionsByDay[todayKey]} session${sessionsByDay[todayKey] > 1 ? 's' : ''} today · great work`
                    : 'One session a day builds lasting fluency — takes ~8 min'}
                </p>
              </div>
            </div>
            {(sessionsByDay[todayKey] ?? 0) === 0 && (
              <Link
                href="/dashboard/practice"
                className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
              >
                Practice now →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* C. KPI cards */}
      <div data-tour="kpi-cards" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Sessions"
          value={String(sessionCount)}
          sub={sessionCount === 1 ? '1 total' : 'lifetime total'}
        />
        <KpiCard
          label="Practice time"
          value={`${totalMins}m`}
          sub="total time"
        />
        <KpiCard
          label="Streak"
          value={`${streak} day${streak !== 1 ? 's' : ''}`}
          sub={streak > 0 ? 'keep it up' : 'start today'}
          valueClass={streak > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}
        />
        <KpiCard
          label="Fluency trend"
          value={trendValue}
          sub={trendSub}
          valueClass={trendClass}
        />
      </div>

      {/* Milestone badges */}
      {sessionCount > 0 && (() => {
        const MILESTONES = [
          { count: 5,  emoji: '🌱', label: '5 sessions',  sublabel: 'First week' },
          { count: 10, emoji: '🔥', label: '10 sessions', sublabel: 'Habit forming' },
          { count: 25, emoji: '🏆', label: '25 sessions', sublabel: 'One month in' },
          { count: 50, emoji: '💎', label: '50 sessions', sublabel: 'Committed' },
        ];
        const earned = MILESTONES.filter(m => sessionCount >= m.count);
        const next   = MILESTONES.find(m => sessionCount < m.count);
        if (!earned.length && !next) return null;
        return (
          <div className="flex flex-wrap gap-2.5">
            {earned.map(m => (
              <div key={m.count} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                <span className="text-base leading-none">{m.emoji}</span>
                <div>
                  <p className="text-xs font-bold leading-tight">{m.label}</p>
                  <p className="text-[10px] text-emerald-500/70 leading-tight">{m.sublabel}</p>
                </div>
              </div>
            ))}
            {next && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-slate-600">
                <span className="text-base leading-none opacity-40">{next.emoji}</span>
                <div>
                  <p className="text-xs font-medium leading-tight">{next.label}</p>
                  <p className="text-[10px] leading-tight">{next.count - sessionCount} to go</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* First-session welcome — replaces the empty state */}
      {sessionCount === 0 && (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border border-emerald-500/20">
          {/* Decorative glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-emerald-500/8 blur-3xl pointer-events-none" />
          <div className="relative px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-8">
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono uppercase tracking-widest mb-4">
                  Week 1 · Stage 1 — Breathing
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-3">
                  Your programme starts here.
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-md">
                  Your first session takes around 5 minutes. Flowen analyses your speech in real time and sets your personalised baseline — no preparation needed, just talk naturally.
                </p>
                <div className="flex flex-wrap gap-4 mb-6">
                  {[
                    { icon: '🎙', label: 'Real-time AI feedback' },
                    { icon: '📊', label: 'Fluency baseline set' },
                    { icon: '🗓', label: '8-week programme unlocked' },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-2 text-sm text-slate-300">
                      <span>{f.icon}</span>
                      <span>{f.label}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/practice"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/25"
                >
                  Start your first session
                  <span aria-hidden>→</span>
                </Link>
              </div>
              {/* Stage ladder preview */}
              <div className="sm:w-44 shrink-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-3">Your 5-stage programme</p>
                <div className="space-y-1.5">
                  {[
                    { n: 1, label: 'Breathing',       active: true  },
                    { n: 2, label: 'Easy Onset',      active: false },
                    { n: 3, label: 'Light Contacts',  active: false },
                    { n: 4, label: 'Pausing',         active: false },
                    { n: 5, label: 'Conversation',    active: false },
                  ].map(s => (
                    <div key={s.n} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                      s.active
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'text-slate-600'
                    }`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        s.active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-600'
                      }`}>{s.n}</span>
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Programme card — only for self-guided users */}
      {programmeState && (
        <div data-tour="programme">
          <ProgrammeCard state={programmeState} />
        </div>
      )}

      {sessionCount > 0 && (
        <>
          {/* D. Activity chart — last 30 days */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-slate-900 dark:text-white font-semibold text-sm">
                Practice activity
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">
                {totalActivitySessions} session
                {totalActivitySessions !== 1 ? 's' : ''} &middot; last 30 days
              </span>
            </div>

            {/* Bars */}
            <div className="flex items-end gap-[3px] h-16">
              {days30.map((day) => {
                const count = sessionsByDay[day] ?? 0;
                const heightPct =
                  count > 0 ? Math.max(12, (count / activityMax) * 100) : 0;
                const isToday = day === todayKey;
                return (
                  <div
                    key={day}
                    className="flex-1 flex flex-col justify-end"
                    title={`${day}: ${count} session${count !== 1 ? 's' : ''}`}
                  >
                    <div
                      style={{ height: count > 0 ? `${heightPct}%` : '2px' }}
                      className={`rounded-sm transition-all ${
                        count === 0
                          ? 'bg-slate-200 dark:bg-slate-800'
                          : isToday
                          ? 'bg-emerald-400'
                          : 'bg-slate-400 dark:bg-slate-600'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Day labels */}
            <div className="flex items-center gap-[3px]">
              {days30.map((day) => {
                const d = new Date(day);
                const dow = d.getUTCDay();
                const show = dow === 1 || dow === 3 || dow === 5;
                return (
                  <div key={day} className="flex-1 text-center">
                    {show ? (
                      <span className="text-[8px] font-mono text-slate-400 dark:text-slate-700">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dow]}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* E. Fluency trend — blocks per minute */}
          {recentBpms.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-slate-900 dark:text-white font-semibold text-sm">
                    Fluency trend
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600">
                    blocks / min &mdash; lower is better
                  </span>
                </div>
                {latestBpm !== null && (
                  <span
                    className={`text-2xl font-bold tabular-nums ${bpmColor(latestBpm)}`}
                  >
                    {latestBpm.toFixed(1)}
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">
                      bpm
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-end gap-2 h-20">
                {recentBpms.map((bpm, i) => {
                  const heightPct = Math.max(8, (bpm / bpmMax) * 100);
                  const opacity =
                    0.6 +
                    (i / Math.max(1, recentBpms.length - 1)) * 0.4;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col justify-end"
                      title={`${bpm.toFixed(1)} blocks/min`}
                    >
                      <div
                        style={{ height: `${heightPct}%`, opacity }}
                        className={`rounded-sm ${bpmBarColor(bpm)}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-700">
                  oldest
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-700">
                  most recent
                </span>
              </div>
            </div>
          )}

          {/* F. Recent session history */}
          {recentSessions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-slate-900 dark:text-white font-semibold text-sm">
                  Recent sessions
                </h2>
                <Link
                  href="/dashboard/history"
                  className="text-[11px] font-mono text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  View all &#8594;
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-100 dark:border-slate-800/60">
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">Date</th>
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">Stage</th>
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">Duration</th>
                      <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">Blocks / min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentSessions.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                          {new Date(s.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-6 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                          {s.stage_id ? (STAGE_NAMES[s.stage_id] ?? `Stage ${s.stage_id}`) : '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-700 dark:text-slate-300 text-xs">
                          {formatDuration(s.duration_seconds)}
                        </td>
                        <td className={`px-6 py-3 text-xs font-semibold tabular-nums ${bpmColor(s.bpm)}`}>
                          {s.bpm.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
