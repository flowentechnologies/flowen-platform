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
  sessionsUsed: number;
  freeLimit:    number;
}

const BENEFITS = [
  'Unlimited practice sessions — practise as often as you like',
  'AI speech coach feedback after every session',
  'Progress tracking across all 5 fluency stages',
  'Clinician-assigned treatment plans & SLP messaging',
  'Block rate charts, trends, and downloadable reports',
  'Full fluency analytics — disfluency trends over time',
];

export function PracticePaywall({ sessionsUsed, freeLimit }: PracticePaywallProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">

        {/* Icon + heading */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Ready for your next session?
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            You&apos;ve completed your {freeLimit} taster sessions. Start a free 7-day trial to keep going — no charge until day 8, cancel any time.
          </p>
        </div>

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
