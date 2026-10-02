/**
 * Shared Google Ads click-conversion upload.
 *
 * Used by:
 *   - /api/webhooks/track-meta           (signup enhanced conversions)
 *   - src/lib/analytics/paid-conversion.ts (verified paid purchases)
 *
 * Hardened against the failure mode found in the 2026-09-29 audit: the
 * upload sets partialFailure: true, and an HTTP 200 can still carry a
 * partialFailureError — the old code marked google_event_sent on any 2xx,
 * silently dropping rejected conversions. This helper parses the response
 * body and surfaces GoogleAdsFailure detail to the caller.
 *
 * Env vars:
 *   GOOGLE_ADS_DEVELOPER_TOKEN              — API Center developer token
 *   GOOGLE_ADS_CUSTOMER_ID                  — operating CID (dashes OK)
 *   GOOGLE_ADS_CONVERSION_ACTION_ID         — signup conversion action
 *   GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID — paid purchase action
 *                                             (no signup fallback)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID            — optional MCC login CID
 *   OAuth: shared GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
 *   GOOGLE_REFRESH_TOKEN (same principal as the spend-sync route). The
 *   legacy GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET /
 *   GOOGLE_ADS_REFRESH_TOKEN triple is honoured as a fallback.
 */

import { getGoogleAccessToken as getSharedGoogleAccessToken } from '@/lib/google-oauth';

function digitsOnly(v: string | undefined): string | undefined {
  return v?.replace(/\D/g, '');
}

async function getAccessToken(): Promise<string> {
  try {
    return await getSharedGoogleAccessToken();
  } catch (primaryErr) {
    const clientId     = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) throw primaryErr;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    const raw = await res.text();
    let json: { access_token?: string } = {};
    try { json = JSON.parse(raw); } catch { /* non-JSON body */ }
    if (!json.access_token) {
      throw new Error(`Google token refresh failed (HTTP ${res.status}): ${raw.slice(0, 300)}`);
    }
    return json.access_token;
  }
}

/** ISO → Google's required "yyyy-MM-dd HH:mm:ss+00:00" */
export function toGoogleDateTime(isoStr: string): string {
  return new Date(isoStr)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '+00:00');
}

export interface ClickConversion {
  gclid: string;
  conversionDateTime: string; // ISO
  conversionValue: number;    // major units (GBP)
  currencyCode: string;
  orderId?: string;           // idempotency key — Stripe invoice ID for purchases
  hashedEmail?: string;       // SHA-256 of normalised email (enhanced conversions)
}

export interface UploadResult {
  ok: boolean;
  status?: number;
  error?: string;             // human-readable, safe to store/log
  notConfigured?: boolean;
}

export async function uploadClickConversion(c: ClickConversion): Promise<UploadResult> {
  const devToken   = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = digitsOnly(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const actionId   = c.orderId
    ? process.env.GOOGLE_ADS_PURCHASE_CONVERSION_ACTION_ID
    : process.env.GOOGLE_ADS_CONVERSION_ACTION_ID;

  if (!devToken || !customerId || !actionId) {
    return { ok: false, notConfigured: true, error: 'Google Ads conversion env vars not configured' };
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const headers: Record<string, string> = {
    'Content-Type':    'application/json',
    'Authorization':   `Bearer ${accessToken}`,
    'developer-token': devToken,
  };
  const loginCustomerId = digitsOnly(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

  const payload = {
    conversions: [{
      gclid:              c.gclid,
      conversionAction:   `customers/${customerId}/conversionActions/${actionId}`,
      conversionDateTime: toGoogleDateTime(c.conversionDateTime),
      conversionValue:    c.conversionValue,
      currencyCode:       c.currencyCode,
      ...(c.orderId      && { orderId: c.orderId }),
      ...(c.hashedEmail  && { userIdentifiers: [{ hashedEmail: c.hashedEmail }] }),
    }],
    partialFailure: true,
  };

  let res: Response;
  try {
    res = await fetch(
      `https://googleads.googleapis.com/v25/customers/${customerId}:uploadClickConversions`,
      { method: 'POST', headers, body: JSON.stringify(payload) },
    );
  } catch (err) {
    return { ok: false, error: `network: ${err instanceof Error ? err.message : String(err)}` };
  }

  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    return { ok: false, status: res.status, error: `HTTP ${res.status}: ${raw.slice(0, 500)}` };
  }

  // HTTP 2xx is NOT proof of acceptance — partialFailure:true means a
  // rejected conversion comes back as 200 with partialFailureError set.
  try {
    const json = JSON.parse(raw) as {
      partialFailureError?: { code?: number; message?: string; details?: unknown };
    };
    if (json.partialFailureError) {
      const detail = `${json.partialFailureError.message ?? 'unknown'} ${JSON.stringify(json.partialFailureError.details ?? '')}`;
      return { ok: false, status: res.status, error: `partialFailure: ${detail}`.slice(0, 500) };
    }
  } catch {
    // Unparseable 2xx body — do not mark as sent.
    return { ok: false, status: res.status, error: `unparseable 2xx body: ${raw.slice(0, 200)}` };
  }

  return { ok: true, status: res.status };
}
