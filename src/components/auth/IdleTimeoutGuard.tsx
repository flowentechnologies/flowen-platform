'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { logoutForReason } from '@/app/auth/actions';
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, LAST_ACTIVITY_STORAGE_KEY } from '@/lib/auth/session-policy';

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
const THROTTLE_MS = 500; // ignore activity events fired more often than this — mousemove/scroll fire constantly

/**
 * Signs the user out after IDLE_TIMEOUT_MS of no mouse/keyboard/touch/scroll
 * activity, with an IDLE_WARNING_MS countdown first. Mounted once in
 * dashboard/layout.tsx and admin/layout.tsx — both are already auth-gated
 * server components, so this only ever runs for a signed-in user.
 *
 * This is a UX safety net (someone walks away from a shared/unlocked
 * device), NOT the actual security boundary — a modified or JS-disabled
 * client bypasses it trivially. That boundary is the server-side stale-
 * session cap in proxy.ts, which enforces independently of this.
 *
 * Cross-tab aware: activity in any tab resets the timer for all of them
 * (shared via a localStorage timestamp + the `storage` event), so typing in
 * one tab doesn't let a second idle tab silently expire out from under it.
 */
export default function IdleTimeoutGuard() {
  const lastActivityRef = useRef(Date.now());
  const lastThrottleRef = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const readSharedActivity = useCallback((): number => {
    try {
      return Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) ?? 0);
    } catch {
      return 0;
    }
  }, []);

  const registerActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
    } catch {
      // Storage unavailable (private browsing, blocked) — falls back to
      // this tab's own activity only; still correct, just not cross-tab.
    }
    setSecondsLeft(null);
  }, []);

  // Activity listeners — throttled so mousemove/scroll don't hammer
  // localStorage or React state on every pixel of movement.
  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current < THROTTLE_MS) return;
      lastThrottleRef.current = now;
      registerActivity();
    };

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handler, { passive: true }));

    // Returning to a backgrounded tab counts as activity — someone switching
    // back to Flowen is choosing to keep using it.
    const onVisible = () => { if (document.visibilityState === 'visible') registerActivity(); };
    document.addEventListener('visibilitychange', onVisible);

    // Another tab's activity — reflect it here immediately rather than
    // waiting for the next 1s tick, so a warning already showing dismisses
    // the moment the user is seen active elsewhere.
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
        const shared = Number(e.newValue);
        if (shared > lastActivityRef.current) {
          lastActivityRef.current = shared;
          setSecondsLeft(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handler));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('storage', onStorage);
    };
  }, [registerActivity]);

  // The actual countdown — polls once a second rather than scheduling a
  // single setTimeout, since the deadline can be pushed out at any moment
  // by activity in another tab.
  useEffect(() => {
    const tick = setInterval(() => {
      const sharedActivity = Math.max(lastActivityRef.current, readSharedActivity());
      const idleMs = Date.now() - sharedActivity;

      if (idleMs >= IDLE_TIMEOUT_MS) {
        clearInterval(tick);
        startTransition(() => { void logoutForReason('idle'); });
        return;
      }

      const msUntilTimeout = IDLE_TIMEOUT_MS - idleMs;
      setSecondsLeft(msUntilTimeout <= IDLE_WARNING_MS ? Math.ceil(msUntilTimeout / 1000) : null);
    }, 1000);

    return () => clearInterval(tick);
  }, [readSharedActivity]);

  if (secondsLeft === null) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-center">
        <p className="text-3xl font-black tabular-nums text-amber-500 mb-2">{secondsLeft}s</p>
        <h2 id="idle-timeout-title" className="text-slate-900 dark:text-white font-bold text-lg mb-1.5">
          Still there?
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
          You&rsquo;ve been inactive — you&rsquo;ll be signed out for security in a moment.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={registerActivity}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-colors"
          >
            Stay signed in
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => { void logoutForReason('idle'); })}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
