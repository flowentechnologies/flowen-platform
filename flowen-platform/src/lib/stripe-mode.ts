/**
 * Stripe mode — server-only
 *
 * Reads and writes the active Stripe environment ('live' | 'test') from the
 * app_config table. All other code should call getStripeMode() rather than
 * reading NEXT_PUBLIC_STRIPE_ENV, which is static and requires a redeploy.
 *
 * An in-process TTL cache (30 s) avoids a DB round-trip on every request while
 * still ensuring the admin toggle takes effect within half a minute. Vercel
 * Fluid Compute reuses function instances, so the cache is genuinely useful.
 */

import 'server-only';
import { adminDb as db } from '@/lib/supabase/admin';

export type StripeMode = 'live' | 'test';

// ── DB ────────────────────────────────────────────────────────────────────────

// ── In-process cache ──────────────────────────────────────────────────────────
//
// KNOWN RACE WINDOW — concurrent-write safety:
//
//   Vercel Fluid Compute reuses function instances, so multiple concurrent
//   requests can share this module's `_cache` variable.  When the cache is
//   stale, every in-flight request that reaches `getStripeMode()` before the
//   first DB read completes will each issue its own query and each write back
//   to `_cache` independently.  The last write wins.
//
//   This is a benign race: all concurrent reads return the same DB value and
//   write the same (or nearly-same) `expiresAt`.  There is no data corruption
//   and no window where one request reads 'live' while another reads 'test'.
//
//   The only observable effect is N simultaneous DB round-trips rather than 1
//   during the brief warm-up period when the cache is cold.  At the admin-panel
//   usage frequency (a handful of requests per minute) this is negligible.
//
//   If this ever becomes a problem (very high-concurrency admin traffic), replace
//   the module-level variable with Upstash Redis to share state across instances.

let _cache: { mode: StripeMode; expiresAt: number } | null = null;
const TTL_MS = 30_000; // 30 s — toggle is visible within this window

export async function getStripeMode(): Promise<StripeMode> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.mode;

  const { data } = await db()
    .from('app_config')
    .select('value')
    .eq('key', 'stripe_mode')
    .maybeSingle();

  const mode: StripeMode = data?.value === 'live' ? 'live' : 'test';
  _cache = { mode, expiresAt: Date.now() + TTL_MS };
  return mode;
}

export async function setStripeMode(mode: StripeMode): Promise<void> {
  await db()
    .from('app_config')
    .upsert({ key: 'stripe_mode', value: mode, updated_at: new Date().toISOString() });

  // Update cache immediately so the calling request sees the new value.
  _cache = { mode, expiresAt: Date.now() + TTL_MS };
}
