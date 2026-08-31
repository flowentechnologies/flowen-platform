'use client';

/**
 * DashboardTour — first-run interactive guide overlay.
 *
 * Shows a step-by-step tour card at the bottom of the screen.
 * Each step scrolls to and highlights the relevant dashboard section.
 * Persisted via localStorage — only shown once. Skippable at any step.
 */

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'flowen_tour_v1';

interface Step {
  /** Matches the data-tour attribute on the target DOM element. 'welcome' = no target. */
  target: string;
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target:  'welcome',
    emoji:   '👋',
    title:   'Welcome to Flowen',
    body:    "Here's your personal practice dashboard. Let's take a 30-second tour — or skip if you'd rather dive straight in.",
  },
  {
    target:  'practice-btn',
    emoji:   '🎯',
    title:   'Start a practice session',
    body:    'Tap "Start Practice" anytime to begin. Your AI coach listens in real-time and helps you work through disfluencies.',
  },
  {
    target:  'checklist',
    emoji:   '✅',
    title:   'Getting started checklist',
    body:    "Complete these five steps to unlock the full dashboard. Follow Flowen on social and we'll apply a 15% discount to your next bill automatically.",
  },
  {
    target:  'kpi-cards',
    emoji:   '📊',
    title:   'Track your progress',
    body:    'Your session count, total practice time, daily streak, and fluency trend — all updated after every session.',
  },
  {
    target:  'programme',
    emoji:   '📅',
    title:   '8-Week fluency programme',
    body:    'Flowen guides you through eight structured weeks. Hit your weekly session target then advance at your own pace.',
  },
];

export function DashboardTour() {
  const [active, setActive]   = useState(false);
  const [step, setStep]       = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Small delay so the dashboard finishes rendering before the tour appears.
        const id = setTimeout(() => setActive(true), 900);
        return () => clearTimeout(id);
      }
    } catch {
      // localStorage blocked (private browsing, etc.) — silently skip the tour.
    }
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }, []);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      dismiss();
    } else {
      setStep(s => s + 1);
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
  }, []);

  // Highlight & scroll to the target element on each step change.
  useEffect(() => {
    if (!active) return;

    const current = STEPS[step];
    if (current.target === 'welcome') return;

    const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
    if (!el) return;

    el.classList.add('tour-target-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return () => {
      el.classList.remove('tour-target-highlight');
    };
  }, [active, step]);

  if (!mounted || !active) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  return createPortal(
    <>
      {/* ── Semi-transparent backdrop ── */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-[9990]"
        aria-hidden
        onClick={dismiss}
      />

      {/* ── Tour card — fixed bottom centre ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-label={`Dashboard tour — step ${step + 1} of ${STEPS.length}: ${current.title}`}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 pointer-events-auto"
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl shadow-slate-950/40 p-6 space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-300">

          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0 mt-0.5" aria-hidden>{current.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Step {step + 1} of {STEPS.length}
              </p>
              <p className="font-bold text-slate-900 dark:text-white text-base leading-snug mt-0.5">
                {current.title}
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-xs font-mono leading-none mt-0.5 px-1"
              aria-label="Skip tutorial"
            >
              skip ✕
            </button>
          </div>

          {/* Body */}
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
            {current.body}
          </p>

          {/* Progress dots + navigation */}
          <div className="flex items-center justify-between gap-4">
            {/* Dot indicators */}
            <div className="flex items-center gap-1.5" aria-hidden>
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === step
                      ? 'w-4 h-1.5 bg-emerald-500'
                      : i < step
                      ? 'w-1.5 h-1.5 bg-emerald-400/50'
                      : 'w-1.5 h-1.5 bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {!isFirst && (
                <button
                  onClick={prev}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={next}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold transition-colors"
              >
                {isLast ? 'Get started →' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
