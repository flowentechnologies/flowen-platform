'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChecklistState {
  accountCreated:    boolean; // always true
  profileComplete:   boolean; // onboarding_complete in profiles
  firstSession:      boolean; // sessionCount >= 1
  socialFollow:      boolean; // social_follow_verified_at IS NOT NULL
  threeSessions:     boolean; // sessionCount >= 3
}

interface GettingStartedChecklistProps {
  state: ChecklistState;
  tier:  string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOCIALS = [
  {
    label: 'Instagram',
    href:  'https://instagram.com/flowenspeech',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href:  'https://tiktok.com/@flowenspeech',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href:  'https://linkedin.com/company/flowen-speech',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
];

// ─── Single checklist step ─────────────────────────────────────────────────────

function Step({
  done,
  locked,
  number,
  title,
  subtitle,
  cta,
  reward,
  children,
}: {
  done:     boolean;
  locked:   boolean;
  number:   number;
  title:    string;
  subtitle: string;
  cta?:     React.ReactNode;
  reward?:  string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative flex gap-4 pb-8 last:pb-0 ${locked ? 'opacity-40 pointer-events-none select-none' : ''}`}>
      {/* Vertical connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-all ${
          done
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : locked
            ? 'bg-slate-800 border-slate-700 text-slate-600'
            : 'bg-slate-900 border-emerald-500/50 text-emerald-400'
        }`}>
          {done ? (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          ) : (
            <span className="text-xs font-bold">{number}</span>
          )}
        </div>
        {/* line down */}
        <div className="w-px flex-1 mt-2 last:hidden bg-slate-800" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5 pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className={`font-semibold text-sm ${done ? 'text-slate-400 line-through' : 'text-white'}`}>
              {title}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          {reward && !done && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {reward}
            </span>
          )}
          {done && reward && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✓ Claimed
            </span>
          )}
        </div>
        {!done && cta && <div className="mt-3">{cta}</div>}
        {children}
      </div>
    </div>
  );
}

// ─── Social follow step (stateful) ────────────────────────────────────────────

function SocialFollowStep({ initialDone }: { initialDone: boolean }) {
  const [opened,    setOpened]    = useState(false);
  const [claimed,   setClaimed]   = useState(initialDone);
  const [pending,   startTransition] = useTransition();
  const [result,    setResult]    = useState<'applied' | 'pending' | null>(null);

  function openAll() {
    for (const s of SOCIALS) {
      window.open(s.href, '_blank', 'noopener,noreferrer');
    }
    setOpened(true);
    posthog.capture('checklist_social_opened', { socials: SOCIALS.map(s => s.label) });
  }

  function claim() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/user/social-follow', { method: 'POST' });
        const json = await res.json() as { ok: boolean; discountApplied?: boolean; discountPending?: boolean };
        if (json.ok) {
          setClaimed(true);
          setResult(json.discountApplied ? 'applied' : 'pending');
          posthog.capture('checklist_social_claimed', {
            discount_applied: json.discountApplied,
            discount_pending: json.discountPending,
          });
        }
      } catch {
        // silent
      }
    });
  }

  return (
    <Step
      done={claimed}
      locked={false}
      number={4}
      title="Follow Flowen on social media"
      subtitle="Stay updated on research, technique tips, and community stories."
      reward="15% off next bill"
    >
      {!claimed && (
        <div className="mt-3 space-y-3">
          {/* Social buttons */}
          <div className="flex flex-wrap gap-2">
            {SOCIALS.map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { setOpened(true); posthog.capture('checklist_social_click', { platform: s.label }); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 text-xs font-semibold transition-all"
              >
                {s.icon}
                {s.label}
              </a>
            ))}
          </div>

          {/* Claim button — appears after any link was opened */}
          {opened && (
            <button
              type="button"
              onClick={claim}
              disabled={pending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all"
            >
              {pending ? 'Verifying…' : "I've followed — claim 15% off →"}
            </button>
          )}
        </div>
      )}

      {claimed && result === 'pending' && (
        <p className="mt-2 text-[11px] text-amber-400/80">
          Discount saved — applies automatically when your subscription is active.
        </p>
      )}
      {claimed && result === 'applied' && (
        <p className="mt-2 text-[11px] text-emerald-400">
          15% discount applied to your next invoice. ✓
        </p>
      )}
    </Step>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GettingStartedChecklist({ state, tier }: GettingStartedChecklistProps) {
  const { accountCreated, profileComplete, firstSession, socialFollow, threeSessions } = state;

  const completedCount = [accountCreated, profileComplete, firstSession, socialFollow, threeSessions]
    .filter(Boolean).length;
  const totalCount = 5;
  const allDone = completedCount === totalCount;

  if (allDone) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">You&apos;re all set up</p>
          <p className="text-xs text-slate-400 mt-0.5">All getting-started tasks complete. Keep practising to build fluency.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 dark:text-slate-600">Getting started</p>
            <h2 className="text-slate-900 dark:text-white font-bold text-base mt-0.5">
              {completedCount} of {totalCount} complete
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 pt-1">
            {Math.round((completedCount / totalCount) * 100)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="px-6 pt-6">
        {/* 1 — Account created */}
        <Step
          done={accountCreated}
          locked={false}
          number={1}
          title="Create your account"
          subtitle="You're in. Welcome to Flowen."
        />

        {/* 2 — Profile complete */}
        <Step
          done={profileComplete}
          locked={!accountCreated}
          number={2}
          title="Complete your profile"
          subtitle="Tell us about yourself so we can personalise your programme."
          cta={
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
            >
              Complete profile →
            </Link>
          }
        />

        {/* 3 — First session */}
        <Step
          done={firstSession}
          locked={!profileComplete}
          number={3}
          title="Complete your first practice session"
          subtitle="Just 5 minutes — your baseline is set and your programme begins."
          cta={
            <Link
              href="/dashboard/practice"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
            >
              Start practice →
            </Link>
          }
        />

        {/* 4 — Social follow (always unlocked — incentive, not gated) */}
        <SocialFollowStep initialDone={socialFollow} />

        {/* 5 — Three sessions */}
        <Step
          done={threeSessions}
          locked={!firstSession}
          number={5}
          title="Complete 3 practice sessions"
          subtitle="Unlocks your full fluency analytics dashboard — trend graphs, heatmaps, and trajectory."
          cta={
            <Link
              href="/dashboard/practice"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              Go to practice →
            </Link>
          }
        />
      </div>

      {/* Footer — R&D research note */}
      <div className="px-6 py-4 mt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <p className="text-[10px] text-slate-400 dark:text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-500 dark:text-slate-500">Research participation:</span>{' '}
          Your usage contributes to Flowen&apos;s clinical evidence base. All data is anonymised and protected under UK GDPR.
          {tier ? null : (
            <>
              {' '}Participation in the free tier supports ongoing R&amp;D into speech biofeedback technology.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
