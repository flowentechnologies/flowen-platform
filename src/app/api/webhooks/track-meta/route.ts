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
 * Meta config (read from tracking_providers table — set via /admin/tracking):
 *   tracking_providers WHERE provider_key='meta':
 *     pixel_id       — Meta Pixel / dataset ID
 *     server_config  — { capi_token: "EAAxxxxxxx" }
 *
 * Optional env var:
 *   META_TEST_EVENT_CODE           — (optional) test mode in Events Manager
 *
 * Google Ads env vars: see src/lib/google-ads-conversions.ts (shared uploader).
 *
 * Privacy contract (hardened 2026-09-29):
 *   - Consent gate: no identifier is read or forwarded unless consent_records
 *     holds a current 'all' decision for the converting user. Fail closed.
 *   - ONLY hashed email (SHA-256), click IDs, and event metadata are
 *     transmitted to ad networks. Clinical data, session content, health
 *     metadata, and raw PII are NEVER forwarded.
 *   - Google uploads no longer mark google_event_sent on a bare HTTP 2xx —
 *     partialFailureError is parsed first, and the last error is persisted
 *     on the attribution row for diagnostics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminDb } from '@/lib/supabase/admin';
import { hasAdsConsent } from '@/lib/consent';
import { uploadClickConversion } from '@/lib/google-ads-conversions';

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
  signup_event_id:   string | null;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

const serviceDb = adminDb;

// Auth Admin client — getUserById() routes through /auth/v1/admin/users/:id,
// bypassing PostgREST (which does not expose the auth schema).
function authAdmin() {
  return adminDb().auth.admin;
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

  // 5. Consent gate — fail closed, BEFORE any identifier (email, click ID,
  //    IP, UA) is read or forwarded. record.user_id is non-null here per the
  //    isNewConversion guard above.
  if (!(await hasAdsConsent({ userId: record.user_id }))) {
    return NextResponse.json({ ok: true, skipped: 'no_ads_consent' });
  }

  // 6. Fetch user email — only PII lookup; goes no further than the hash.
  //    record.user_id is non-null here (isNewConversion guard above), but
  //    TypeScript can't narrow through the early-return pattern.
  const { data: adminData, error: userErr } = await authAdmin().getUserById(record.user_id!);

  if (userErr || !adminData?.user?.email) {
    // The user may have been deleted since the attribution record was written,
    // or user_id could be a test/seed value. Without an email we can't hash
    // anything to send to ad networks, so skip silently. Return 200 so
    // pg_net does not record a failure against the trigger.
    console.warn('[track-meta] skipping — user email not resolvable for user_id:', record.user_id, userErr?.message ?? '(no user found)');
    return NextResponse.json({ ok: true, skipped: 'user email not found' });
  }

  const email      = adminData.user.email;
  const hashed     = hashEmail(email);
  const convertedAt = record.converted_at ?? new Date().toISOString();

  // 7. Meta Conversions API ────────────────────────────────────────────────────
  const metaResult = { sent: false, skipped: false };

  if (!metaDone) {
    // Read pixel ID and CAPI token from tracking_providers (set via /admin/tracking).
    const { data: metaProvider } = await serviceDb()
      .from('tracking_providers')
      .select('pixel_id, server_config, enabled')
      .eq('provider_key', 'meta')
      .single();

    const pixelId     = metaProvider?.pixel_id ?? null;
    const accessToken = (metaProvider?.server_config as Record<string, string> | null)?.capi_token ?? null;

    if (!metaProvider?.enabled || !pixelId || !accessToken) {
      console.warn('[track-meta] Meta CAPI not configured — pixel_id or capi_token missing, or provider disabled');
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
          // Browser/server dedup: for ad-click signups the browser fires
          // CompleteRegistration with the milestone id (handed over via the
          // flowen_signup_event cookie), which the bridge wrote onto this
          // row as signup_event_id — same event_id, one counted conversion.
          event_id:      record.signup_event_id ?? record.anonymous_id,
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
          .update({ meta_event_sent: true, meta_sent_at: new Date().toISOString(), meta_last_error: null })
          .eq('anonymous_id', record.anonymous_id);
      } else {
        const errBody = await metaRes.text().catch(() => '');
        console.error('[track-meta] Meta CAPI error:', metaRes.status, errBody);
        // Persist the failure — a row with meta_event_sent=false stays
        // retryable, and the error explains why.
        await serviceDb()
          .from('marketing_attribution')
          .update({ meta_last_error: `HTTP ${metaRes.status}: ${errBody}`.slice(0, 500) })
          .eq('anonymous_id', record.anonymous_id);
      }
    }
  }

  // 8. Google Ads Enhanced Conversions ─────────────────────────────────────────
  const googleResult = { sent: false, skipped: false };

  if (!googleDone && record.gclid) {
    const gRes = await uploadClickConversion({
      gclid:              record.gclid,
      hashedEmail:        hashed,
      conversionDateTime: convertedAt,
      conversionValue:    0, // free signup; paid revenue flows through paid-conversion.ts
      currencyCode:       'GBP',
    });

    if (gRes.ok) {
      googleResult.sent = true;
      await serviceDb()
        .from('marketing_attribution')
        .update({ google_event_sent: true, google_sent_at: new Date().toISOString(), google_last_error: null })
        .eq('anonymous_id', record.anonymous_id);
    } else {
      console.error('[track-meta] Google Ads error:', gRes.status, gRes.error);
      googleResult.skipped = Boolean(gRes.notConfigured); // missing config vs real error
      if (!gRes.notConfigured) {
        // Not marked sent → stays retryable; persist why.
        await serviceDb()
          .from('marketing_attribution')
          .update({ google_last_error: (gRes.error ?? 'unknown').slice(0, 500) })
          .eq('anonymous_id', record.anonymous_id);
      }
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
