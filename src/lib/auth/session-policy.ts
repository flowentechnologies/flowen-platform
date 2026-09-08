/**
 * Shared constants for the auth session lifecycle. Two independent
 * mechanisms enforce this, for different threat models:
 *
 *   - Stale session cap — enforced server-side in src/proxy.ts, on every
 *     request. Bounds how long a session stays valid at all, regardless of
 *     activity. Defends against a leaked/stolen session cookie being useful
 *     indefinitely, and against a device left signed in being usable forever.
 *
 *   - Idle (dormant) timeout — enforced client-side by IdleTimeoutGuard.
 *     Signs a user out after real inactivity within a single sitting, with a
 *     warning first. This one CANNOT be the only line of defense (a modified
 *     or JS-disabled client trivially bypasses it) — it exists for the UX
 *     case (someone walks away from a shared/unlocked device), while the
 *     stale-session cap above is the actual security boundary.
 */

export const SESSION_STARTED_COOKIE = 'flowen_session_started_at';

/** Absolute session lifetime — forces re-login after this long no matter how active the user is. */
export const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** No mouse/keyboard/touch/scroll activity for this long → treated as dormant. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/** Countdown shown before the idle sign-out actually fires, giving the user a chance to stay signed in. */
export const IDLE_WARNING_MS = 60 * 1000; // 60 seconds

/** localStorage key activity listeners write to — the cross-tab sync channel for IdleTimeoutGuard. */
export const LAST_ACTIVITY_STORAGE_KEY = 'flowen_last_activity';

export type SessionAgeCheck = 'stale' | 'seed' | 'ok';

/**
 * Pure decision function behind proxy.ts's stale-session cap.
 *   'seed'  — no cookie yet (a session that predates this feature, or the
 *             rare race where the login-time cookie write hasn't landed).
 *             Starts the clock now rather than treating "absent" as
 *             "instantly expired," which would mass-log-out every
 *             already-signed-in user the moment this deployed.
 *   'stale' — older than MAX_SESSION_AGE_MS → force sign-out.
 *   'ok'    — within the cap → no action.
 */
export function checkSessionAge(startedAtRaw: string | undefined, now: number): SessionAgeCheck {
  if (!startedAtRaw) return 'seed';
  const startedAt = Number(startedAtRaw);
  if (!Number.isFinite(startedAt)) return 'seed';
  return now - startedAt > MAX_SESSION_AGE_MS ? 'stale' : 'ok';
}

export function sessionStartedCookieOptions() {
  return {
    path: '/',
    // A little longer than the cap itself so the cookie can never expire
    // browser-side before proxy.ts gets a chance to enforce the cap itself.
    maxAge: Math.floor(MAX_SESSION_AGE_MS / 1000) + 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}
