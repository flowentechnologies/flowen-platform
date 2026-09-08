import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * getUser() forces a network revalidation against Supabase Auth on every
 * call. Under concurrent request load — several requests racing the same
 * refresh-token rotation (nav-link prefetching, background polling, a page
 * load's own requests all firing together) — the "losing" request gets a
 * transient 400-status AuthApiError (typically refresh_token_already_used)
 * even though the session is perfectly valid; a sibling request simply won
 * the race a moment earlier and already holds the fresh token.
 *
 * src/proxy.ts handles this same race class for page navigation (never
 * clearing session cookies over it — see the isPrefetch check there), but a
 * route handler calling getUser() directly has no such protection. For a
 * real user-initiated action — starting checkout, saving a form, sending a
 * message — treating one transient race-loss as "not logged in" is wrong:
 * it bounces a genuinely signed-in user to the login page for no reason
 * they can see, and if they land right back on the same page and retry the
 * same action, it can lose the race again and loop.
 *
 * This retries once after a short pause, by which point the sibling
 * request's rotation has settled and the now-fresh token is available.
 */
export async function getUserWithRetry(
  supabase: SupabaseClient,
  { retries = 1, delayMs = 300 }: { retries?: number; delayMs?: number } = {},
): Promise<User | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error) return data.user;
      if (error.status !== 400 || attempt === retries) return null;
    } catch {
      if (attempt === retries) return null;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return null;
}
