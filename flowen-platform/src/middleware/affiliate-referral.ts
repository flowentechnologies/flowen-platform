/**
 * Affiliate referral tracking — composable proxy module.
 *
 * On every request that carries a `?ref=CODE` query parameter:
 *   1. Sets (or refreshes) the `flowen_ref` cookie for 30 days.
 *   2. Fire-and-forgets a click record into `affiliate_clicks` via the
 *      Supabase REST API — no latency added to the HTTP response.
 *
 * If the cookie already exists and no new `ref=` param is present, the
 * function is a no-op (O(1), no network calls).
 *
 * Attribution model: last-touch — a new `?ref=` param always overwrites
 * the existing cookie so the most-recent referrer gets credit.
 *
 * Cookie design:
 *   - `flowen_ref`  httpOnly, SameSite=Lax, Secure in production, 30-day TTL
 *   - HttpOnly prevents client-side script access (XSS resistance)
 *   - The value is the raw affiliate code (e.g. "SLT-JANE"), not a UUID,
 *     so it is human-readable in server logs without a DB lookup.
 */

import { NextRequest, NextResponse } from 'next/server';

export const REF_COOKIE      = 'flowen_ref';
export const REF_COOKIE_TTL  = 60 * 60 * 24 * 30; // 30 days

// ── Supabase REST helpers (no SDK — keeps the proxy bundle small) ──────────────

async function lookupAffiliate(code: string): Promise<string | null> {
  const url = new URL(
    `/rest/v1/affiliates?code=eq.${encodeURIComponent(code)}&status=eq.active&select=id&limit=1`,
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
  );
  try {
    const res = await fetch(url.toString(), {
      headers: {
        apikey:        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        Accept:        'application/json',
      },
    });
    const rows = await res.json() as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function logClick(
  affiliateId: string,
  landingPath:  string,
  ipHash:       string | null,
  userAgent:    string | null,
): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL!}/rest/v1/affiliate_clicks`;
  await fetch(url, {
    method:  'POST',
    headers: {
      apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization:  `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify({
      affiliate_id: affiliateId,
      landing_path: landingPath,
      ip_hash:      ipHash,
      user_agent:   userAgent,
    }),
  });
}

function hashIp(ip: string): string {
  // Deterministic one-way hash — good enough for dedup / geo, GDPR-safe.
  let h = 5381;
  for (let i = 0; i < ip.length; i++) {
    h = ((h << 5) + h) ^ ip.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Call from proxy.ts, passing the current request and the in-flight response.
 * Mutates `response.cookies` when a ref cookie needs to be set/refreshed.
 *
 * Returns true if a new referral was detected (the cookie was set/updated).
 */
export function applyAffiliateReferral(
  request:  NextRequest,
  response: NextResponse,
): boolean {
  const code    = request.nextUrl.searchParams.get('ref')?.trim().toUpperCase();
  const isSecure = process.env.NODE_ENV === 'production';

  if (!code) return false;

  // Validate code format: 2-40 uppercase alphanum + hyphens
  if (!/^[A-Z0-9][A-Z0-9-]{1,38}[A-Z0-9]$/.test(code)) return false;

  // Set / refresh the cookie immediately (no DB wait)
  response.cookies.set(REF_COOKIE, code, {
    path:     '/',
    maxAge:   REF_COOKIE_TTL,
    httpOnly: true,
    sameSite: 'lax',
    secure:   isSecure,
  });

  // Fire-and-forget the click log — does not block the response
  const rawIp    = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
  const ipHash   = rawIp ? hashIp(rawIp) : null;
  const ua       = request.headers.get('user-agent') ?? null;
  const landing  = request.nextUrl.pathname;

  void (async () => {
    try {
      const affiliateId = await lookupAffiliate(code);
      if (!affiliateId) return;
      await logClick(affiliateId, landing, ipHash, ua);
    } catch {
      // Attribution failure must never impact page delivery
    }
  })();

  return true;
}
