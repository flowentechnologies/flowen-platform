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
import { createClient } from '@supabase/supabase-js';

export type StripeMode = 'live' | 'test';

// ── DB ────────────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── In-process cache ──────────────────────────────────────────────────────────

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
