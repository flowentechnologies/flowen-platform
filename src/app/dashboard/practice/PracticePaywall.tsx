'use client';

/**
 * PracticePaywall
 *
 * Shown to free-tier users who have exhausted their FREE_SESSION_LIMIT taster
 * sessions. Keeps them on /dashboard/practice so they can see what they're
 * missing, and gives them a clear upgrade CTA.
 */

import Link from 'next/link';

interface PracticePaywallProps {
  sessionsUsed:    number;
  freeLimit:       number;
  streak:          number;
  daysActive:      number;
  bpmImprovement:  number | null; // positive = fewer blocks/min (better), null = no data
}

const BENEFITS = [
  'Unlimited practice sessions — practise as often as you like',
  'AI speech coach feedback after every session',
  'Progress tracking across all 5 fluency stages',
  'Clinician-assigned treatment plans & SLP messaging',
  'Block rate charts, trends, and downloadable reports',
  'Full fluency analytics — disfluency trends over time',
];

export function PracticePaywall({ sessionsUsed, freeLimit, streak, daysActive, bpmImprovement }: PracticePaywallProps) {
  const streakLabel = streak >= 2 ? `${streak}-day streak` : streak === 1 ? '1-day streak' : 'Building your streak';
  const improvementLabel = bpmImprovement !== null && bpmImprovement > 0.1
    ? `${bpmImprovement.toFixed(1)} fewer blocks/min`
    : null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">

        {/* Value anchor — progress so far */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-500">Your progress</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              You&apos;ve already started
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {sessionsUsed} sessions in {daysActive} {daysActive === 1 ? 'day' : 'days'} — keep going to see real results.
            </p>
          </div>

          {/* Stats grid */}
          <div className={`grid gap-3 ${improvementLabel ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4 text-center space-y-1">
              <p className="text-2xl font-extrabold text-emerald-400">{sessionsUsed}</p>
              <p className="text-[11px] text-slate-500 leading-tight">Sessions done</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-4 text-center space-y-1">
              <p className="text-2xl font-extrabold text-amber-400">🔥</p>
              <p className="text-[11px] text-slate-500 leading-tight">{streakLabel}</p>
            </div>
            {improvementLabel && (
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl px-4 py-4 text-center space-y-1">
                <p className="text-2xl font-extrabold text-emerald-400">↓</p>
                <p className="text-[11px] text-slate-500 leading-tight">{improvementLabel}</p>
              </div>
            )}
          </div>

          {/* Transition */}
          <p className="text-center text-sm text-slate-400 leading-relaxed">
            Your taster sessions are done. Start a free 7-day trial to keep building —{' '}
            <span className="text-slate-300 font-medium">no charge until day 8, cancel any time.</span>
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* Benefits list */}
        <ul className="space-y-3">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
              <svg className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {b}
            </li>
          ))}
        </ul>

        {/* Social proof */}
        <div className="space-y-3">
          {/* Testimonial */}
          <blockquote className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 space-y-2">
            <p className="text-slate-300 text-sm leading-relaxed italic">
              &ldquo;After 8 weeks with Flowen I went from dreading calls to leading them. The AI feedback after each session is genuinely useful — not generic.&rdquo;
            </p>
            <footer className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span className="text-emerald-400 text-[11px] font-bold">JR</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200 leading-tight">James R.</p>
                <p className="text-[11px] text-slate-500 leading-tight">Flowen member · 14-day streak</p>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3 h-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                ))}
              </div>
            </footer>
          </blockquote>

          {/* Clinical credential badge */}
          <div className="flex items-center gap-3 bg-sky-950/40 border border-sky-800/40 rounded-2xl px-4 py-3">
            <svg className="w-8 h-8 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.628 5.373 12 12 12s12-5.372 12-12c0-2.049-.513-3.978-1.418-5.664L12 2.714z" />
            </svg>
            <div>
              <p className="text-xs font-bold text-sky-200 leading-tight">DCB0129 Clinical Safety · NHS DTAC Assessed</p>
              <p className="text-[11px] text-sky-400/70 leading-tight mt-0.5">Built to NHS digital clinical safety standards for speech & language therapy platforms.</p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            href="/pricing"
            className="block w-full text-center rounded-xl px-6 py-4 font-bold text-sm bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Start 7-day free trial →
          </Link>
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            No charge today · Then from £19.96/mo · Cancel any time before day 8
          </p>
          <Link
            href="/dashboard"
            className="block w-full text-center rounded-xl px-6 py-3 font-medium text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>

        {/* Reassurance note */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Your {sessionsUsed} completed sessions and all your progress are saved — they&apos;ll be right here when your trial starts.
        </p>

      </div>
    </div>
  );
}
