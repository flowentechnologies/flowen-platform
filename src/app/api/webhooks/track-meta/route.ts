/**
 * /api/webhooks/track-meta
 *
 * Receives a Supabase Database Webhook fired whenever a row in
 * marketing_attribution is updated with a user_id (i.e. a new conversion).
 * Forwards the conversion to:
 *   1. Meta Conversions API (CAPI)  — always, when configured
 *   2. Google Ads Enhanced Conversions — when gclid is present and configured
 *
 * Trigger: public.marketing_attribution AFTER UPDATE (see Supabase migration)
 * URL:     https://www.flowen.digital/api/webhooks/track-meta
 * Auth:    Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>
 *
 * Required env vars:
 *   SUPABASE_WEBHOOK_SECRET        — shared secret verified on every request
 *
 * Meta env vars:
 *   META_PIXEL_ID                  — Meta Pixel / dataset ID
 *   META_ACCESS_TOKEN              — Meta system user access token
 *   META_TEST_EVENT_CODE           — (optional) test mode in Events Manager
 *
 * Google Ads env vars:
 *   GOOGLE_ADS_DEVELOPER_TOKEN     — Google Ads API developer token
 *   GOOGLE_ADS_CUSTOMER_ID         — Google Ads customer account ID (no dashes)
 *   GOOGLE_ADS_CONVERSION_ACTION_ID — numeric conversion action ID
 *   GOOGLE_ADS_CLIENT_ID           — OAuth2 client ID
 *   GOOGLE_ADS_CLIENT_SECRET       — OAuth2 client secret
 *   GOOGLE_ADS_REFRESH_TOKEN       — OAuth2 refresh token (offline access)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID   — (optional) MCC / manager account ID
 *
 * Privacy contract:
 *   ONLY hashed email (SHA-256), click IDs, and event metadata are transmitted
 *   to ad networks. Clinical data, session content, health metadata, and raw
 *   PII are NEVER forwarded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupabaseWebhookPayload {
  type:       'INSERT' | 'UPDATE' | 'DELETE';
  table:      string;
  schema:     string;
  record:     AttributionRecord | null;
  old_record: AttributionRecord | null;
}

interface AttributionRecord {
  anonymous_id:      string;
  user_id:           string | null;
  fbclid:            string | null;
  gclid:             string | null;
  utm_source:        string | null;
  utm_campaign:      string | null;
  ip_address:        string | null;
  user_agent:        string | null;
  converted_at:      string | null;
  conversion_type:   string | null;
  meta_event_sent:   boolean;
  google_event_sent: boolean;
  first_seen_at:     string;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Auth Admin client — getUserById() routes through /auth/v1/admin/users/:id,
// bypassing PostgREST (which does not expose the auth schema).
function authAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ).auth.admin;
}

// ── Shared crypto helpers ─────────────────────────────────────────────────────

/**
 * SHA-256 hash of a normalised email.
 * Both Meta and Google require: lowercase, trimmed, then hashed.
 */
function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex');
}

// ── Meta helpers ──────────────────────────────────────────────────────────────

/**
 * Converts a raw fbclid into Meta's fbc cookie format.
 * Format: fb.1.{unix_ts_seconds}.{fbclid}
 */
function toFbc(fbclid: string, createdAtIso: string): string {
  const ts = Math.floor(new Date(createdAtIso).getTime() / 1000);
  return `fb.1.${ts}.${fbclid}`;
}

/**
 * Maps our conversion_type to a Meta standard event name.
 * Never use clinical or health-specific event names.
 */
function metaEventName(conversionType: string | null): string {
  switch (conversionType) {
    case 'subscription': return 'Purchase';
    case 'trial':        return 'StartTrial';
    case 'signup':
    default:             return 'CompleteRegistration';
  }
}

// ── Google Ads helpers ────────────────────────────────────────────────────────

/**
 * Exchanges a refresh token for a short-lived OAuth2 access token.
 * Returns null if credentials are missing or the exchange fails.
 */
async function getGoogleAccessToken(): Promise<string | null> {
  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('[track-meta] Google OAuth token error:', res.status, err);
    return null;
  }

  const { access_token } = await res.json();
  return (access_token as string) ?? null;
}

/**
 * Formats an ISO timestamp into the format Google Ads requires:
 * "yyyy-MM-dd HH:mm:ss+00:00"
 */
function toGoogleDateTime(isoStr: string): string {
  return new Date(isoStr)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '+00:00');
}

/**
 * Uploads a click conversion to Google Ads Enhanced Conversions.
 * Only called when a gclid is present on the attribution record.
 *
 * Docs: https://developers.google.com/google-ads/api/docs/conversions/upload-clicks
 */
async function sendGoogleAdsConversion({
  gclid,
  hashedEmail,
  conversionDateTime,
}: {
  gclid:              string;
  hashedEmail:        string;
  conversionDateTime: string;
}): Promise<{ ok: boolean; status?: number; body?: string }> {
  const devToken   = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, ''); // strip dashes
  const actionId   = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID;

  if (!devToken || !customerId || !actionId) {
    return { ok: false, body: 'Google Ads env vars not configured' };
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return { ok: false, body: 'Failed to obtain Google OAuth token' };
  }

  const headers: Record<string, string> = {
    'Content-Type':   'application/json',
    'Authorization':  `Bearer ${accessToken}`,
    'developer-token': devToken,
  };

  // Include manager account ID if the customer is under an MCC.
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '');
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  const payload = {
    conversions: [{
      gclid,
      conversionAction: `customers/${customerId}/conversionActions/${actionId}`,
      conversionDateTime: toGoogleDateTime(conversionDateTime),
      // Value 0 for free signup; extend with real revenue when subscription fires.
      conversionValue: 0,
      currencyCode:    'GBP',
      // Enhanced Conversions — hashed email for improved match rates.
      userIdentifiers: [{ hashedEmail }],
    }],
    partialFailure: true,
  };

  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${customerId}:uploadClickConversions`,
    {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload),
    },
  );

  const body = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body };
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Authenticate — shared secret in Authorization: Bearer header.
  const authHeader = req.headers.get('authorization') ?? '';
  const secret     = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse payload.
  let payload: SupabaseWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, record, old_record } = payload;
  if (!record) return NextResponse.json({ ok: true, skipped: 'no record' });

  // 3. Only act on the conversion moment: user_id transitions NULL → non-NULL.
  const isNewConversion =
    type === 'UPDATE' &&
    record.user_id !== null &&
    (old_record?.user_id ?? null) === null;

  if (!isNewConversion) {
    return NextResponse.json({ ok: true, skipped: 'not a new conversion' });
  }

  // 4. Skip if both ad networks are already done.
  //    (google is N/A when no gclid — counts as done for the purpose of this guard)
  const metaDone   = record.meta_event_sent;
  const googleDone = record.google_event_sent || !record.gclid;
  if (metaDone && googleDone) {
    return NextResponse.json({ ok: true, skipped: 'already sent to all configured networks' });
  }

  // 5. Fetch user email — only PII lookup; goes no further than the hash.
  //    record.user_id is non-null here (isNewConversion guard above), but
  //    TypeScript can't narrow through the early-return pattern.
  const { data: adminData, error: userErr } = await authAdmin().getUserById(record.user_id!);

  if (userErr || !adminData?.user?.email) {
    console.error('[track-meta] could not resolve user email:', userErr?.message);
    return NextResponse.json({ error: 'User email not found' }, { status: 500 });
  }

  const email      = adminData.user.email;
  const hashed     = hashEmail(email);
  const convertedAt = record.converted_at ?? new Date().toISOString();

  // 6. Meta Conversions API ────────────────────────────────────────────────────
  const metaResult = { sent: false, skipped: false };

  if (!metaDone) {
    const pixelId     = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn('[track-meta] Meta env vars not configured — skipping');
      metaResult.skipped = true;
    } else {
      const eventTime = Math.floor(new Date(convertedAt).getTime() / 1000);

      const userData: Record<string, string | string[]> = { em: [hashed] };
      if (record.fbclid)    userData.fbc               = toFbc(record.fbclid, record.first_seen_at);
      if (record.ip_address) userData.client_ip_address = record.ip_address;
      if (record.user_agent) userData.client_user_agent  = record.user_agent;

      const capiPayload = {
        data: [{
          event_name:    metaEventName(record.conversion_type),
          event_time:    eventTime,
          event_id:      record.anonymous_id, // deduplication key
          action_source: 'website',
          user_data:     userData,
          ...(record.conversion_type === 'subscription' && {
            custom_data: { currency: 'GBP', value: 0 },
          }),
        }],
        ...(process.env.META_TEST_EVENT_CODE && {
          test_event_code: process.env.META_TEST_EVENT_CODE,
        }),
      };

      const metaRes = await fetch(
        `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(capiPayload),
        },
      );

      if (metaRes.ok) {
        metaResult.sent = true;
        await serviceDb()
          .from('marketing_attribution')
          .update({ meta_event_sent: true, meta_sent_at: new Date().toISOString() })
          .eq('anonymous_id', record.anonymous_id);
      } else {
        const errBody = await metaRes.text().catch(() => '');
        console.error('[track-meta] Meta CAPI error:', metaRes.status, errBody);
      }
    }
  }

  // 7. Google Ads Enhanced Conversions ─────────────────────────────────────────
  const googleResult = { sent: false, skipped: false };

  if (!googleDone && record.gclid) {
    const gRes = await sendGoogleAdsConversion({
      gclid:              record.gclid,
      hashedEmail:        hashed,
      conversionDateTime: convertedAt,
    });

    if (gRes.ok) {
      googleResult.sent = true;
      await serviceDb()
        .from('marketing_attribution')
        .update({ google_event_sent: true, google_sent_at: new Date().toISOString() })
        .eq('anonymous_id', record.anonymous_id);
    } else {
      console.error('[track-meta] Google Ads error:', gRes.status, gRes.body);
      googleResult.skipped = !process.env.GOOGLE_ADS_DEVELOPER_TOKEN; // missing config vs real error
    }
  } else {
    googleResult.skipped = true; // no gclid or already sent
  }

  return NextResponse.json({
    ok:     true,
    meta:   metaDone   ? 'already_done' : metaResult.sent   ? 'sent' : 'failed',
    google: googleDone ? 'already_done' : googleResult.sent ? 'sent' : googleResult.skipped ? 'skipped' : 'failed',
  });
}
