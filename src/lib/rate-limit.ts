/**
 * Distributed rate limiter — Upstash Redis sliding windows.
 *
 * In production (UPSTASH_REDIS_REST_URL set): uses Upstash Redis so limits
 * are shared across all Vercel Fluid Compute instances and regions.
 *
 * In development (env vars absent): falls back to an in-process Map.
 * The fallback is per-instance and NOT suitable for multi-region production —
 * always configure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in prod.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';

// ── In-process fallback (dev / CI only) ──────────────────────────────────────

const _fallbackCache = new Map<string, { count: number; reset: number }>();

function fallbackCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = _fallbackCache.get(key) ?? { count: 0, reset: now + windowMs };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
  rec.count += 1;
  _fallbackCache.set(key, rec);
  return rec.count <= limit;
}

// ── Lazy Upstash singletons ───────────────────────────────────────────────────

let _redis: Redis | null | undefined;  // undefined = not yet initialised

function redis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

// One limiter per traffic class.  The prefix namespaces keys in Redis so
// different limiters don't share counters.
let _apiLimiter:  Ratelimit | null | undefined;
let _pageLimiter: Ratelimit | null | undefined;
let _aiLimiter:   Ratelimit | null | undefined;
let _errLimiter:  Ratelimit | null | undefined;

function buildLimiter(
  slot: Ratelimit | null | undefined,
  requests: number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
  prefix: string,
): Ratelimit | null {
  if (slot !== undefined) return slot;
  const r = redis();
  return r ? new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(requests, window), prefix }) : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Proxy / middleware rate limit.
 * API paths: 60 req / min. Page paths: 120 req / min.
 * Key: IP address.
 */
export async function checkProxyRateLimit(ip: string, isApi: boolean): Promise<boolean> {
  if (isApi) {
    _apiLimiter = _apiLimiter ?? buildLimiter(_apiLimiter, 60,  '1 m', 'rl:api');
    if (_apiLimiter) {
      const { success } = await _apiLimiter.limit(ip);
      return success;
    }
    return fallbackCheck(`api:${ip}`, 60, 60_000);
  }
  _pageLimiter = _pageLimiter ?? buildLimiter(_pageLimiter, 120, '1 m', 'rl:page');
  if (_pageLimiter) {
    const { success } = await _pageLimiter.limit(ip);
    return success;
  }
  return fallbackCheck(`page:${ip}`, 120, 60_000);
}

/**
 * Per-user AI / Claude rate limit: 30 coach requests per user per hour.
 * Key: Supabase user UUID.
 */
export async function checkAiRateLimit(userId: string): Promise<boolean> {
  _aiLimiter = _aiLimiter ?? buildLimiter(_aiLimiter, 30, '1 h', 'rl:ai');
  if (_aiLimiter) {
    const { success } = await _aiLimiter.limit(userId);
    return success;
  }
  return fallbackCheck(`ai:${userId}`, 30, 60 * 60_000);
}

/**
 * Error-boundary endpoint rate limit: 20 reports per IP per minute.
 * Prevents unauthenticated callers from flooding system_error_logs.
 * Key: IP address.
 */
export async function checkErrorBoundaryRateLimit(ip: string): Promise<boolean> {
  _errLimiter = _errLimiter ?? buildLimiter(_errLimiter, 20, '1 m', 'rl:err');
  if (_errLimiter) {
    const { success } = await _errLimiter.limit(ip);
    return success;
  }
  return fallbackCheck(`err:${ip}`, 20, 60_000);
}

// ── Stripe checkout ───────────────────────────────────────────────────────────

let _checkoutIpLimiter:   Ratelimit | null | undefined;
let _checkoutUserLimiter: Ratelimit | null | undefined;

/**
 * Stripe checkout rate limit — two layered windows:
 *   IP:   5 attempts per 15 minutes  (blocks card-testing bots)
 *   User: 10 attempts per hour       (prevents accidental loop hammering)
 *
 * Returns { allowed: true } when both pass, or { allowed: false, reason }
 * when either window is exceeded.
 */
export async function checkCheckoutRateLimit(
  ip: string,
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // ── Per-IP window ──────────────────────────────────────────────────────────
  _checkoutIpLimiter = _checkoutIpLimiter
    ?? buildLimiter(_checkoutIpLimiter, 5, '15 m', 'rl:checkout:ip');

  const ipOk = _checkoutIpLimiter
    ? (await _checkoutIpLimiter.limit(ip)).success
    : fallbackCheck(`checkout:ip:${ip}`, 5, 15 * 60_000);

  if (!ipOk) return { allowed: false, reason: 'Too many checkout attempts from this IP. Please wait 15 minutes.' };

  // ── Per-user window ────────────────────────────────────────────────────────
  _checkoutUserLimiter = _checkoutUserLimiter
    ?? buildLimiter(_checkoutUserLimiter, 10, '1 h', 'rl:checkout:user');

  const userOk = _checkoutUserLimiter
    ? (await _checkoutUserLimiter.limit(userId)).success
    : fallbackCheck(`checkout:user:${userId}`, 10, 60 * 60_000);

  if (!userOk) return { allowed: false, reason: 'Too many checkout attempts on this account. Please try again in an hour.' };

  return { allowed: true };
}
