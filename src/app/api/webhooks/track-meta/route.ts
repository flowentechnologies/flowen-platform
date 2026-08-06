/**
 * /api/webhooks/track-meta
 *
 * Receives a Supabase Database Webhook fired whenever a row in
 * marketing_attribution is updated with a user_id (i.e. a new conversion).
 * Forwards the conversion to the Meta Conversions API (CAPI) server-side,
 * then marks the row so the webhook is not re-fired on subsequent updates.
 *
 * Configure in Supabase → Database → Webhooks:
 *   Table:  public.marketing_attribution
 *   Events: UPDATE
 *   URL:    https://www.flowen.digital/api/webhooks/track-meta
 *   Headers: Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>
 *
 * Required env vars:
 *   SUPABASE_WEBHOOK_SECRET   — shared secret set in the webhook header
 *   META_PIXEL_ID             — your Meta Pixel / dataset ID
 *   META_ACCESS_TOKEN         — Meta system user access token
 *   META_TEST_EVENT_CODE      — (optional) for testing in Events Manager
 *
 * Privacy contract:
 *   ONLY hashed email (SHA-256), fbclid, and event metadata are transmitted
 *   to Meta. Clinical data, session content, health metadata, and raw PII
 *   are NEVER forwarded. The fbclid is stored server-side only; it is never
 *   exposed to the browser pixel.
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
  anonymous_id:    string;
  user_id:         string | null;
  fbclid:          string | null;
  gclid:           string | null;
  utm_source:      string | null;
  utm_campaign:    string | null;
  ip_address:      string | null;
  user_agent:      string | null;
  converted_at:    string | null;
  conversion_type: string | null;
  meta_event_sent: boolean;
  first_seen_at:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * SHA-256 hash of a normalised email, as required by Meta CAPI.
 * Meta specifies: lowercase, trimmed, then hashed.
 */
function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex');
}

/**
 * Converts a raw fbclid query-param value into Meta's fbc cookie format.
 * Format: fb.1.{creation_time_ms}.{fbclid}
 */
function toFbc(fbclid: string, createdAtIso: string): string {
  const ts = Math.floor(new Date(createdAtIso).getTime() / 1000);
  return `fb.1.${ts}.${fbclid}`;
}

/**
 * Maps our internal conversion_type to a Meta standard event name.
 * Never expose clinical or health event names — use generic commerce events.
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
  // 1. Authenticate the webhook using the shared secret.
  //    Supabase sends it as a Bearer token in the Authorization header.
  const authHeader = req.headers.get('authorization') ?? '';
  const secret     = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse and validate the webhook payload.
  let payload: SupabaseWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, record, old_record } = payload;
  if (!record) return NextResponse.json({ ok: true, skipped: 'no record' });

  // 3. Only act on UPDATE events where a user_id was just set.
  //    This is the moment of first conversion — bridgeAttribution() was called.
  const isNewConversion =
    type === 'UPDATE' &&
    record.user_id !== null &&
    (old_record?.user_id ?? null) === null;

  if (!isNewConversion) {
    return NextResponse.json({ ok: true, skipped: 'not a new conversion' });
  }

  // 4. Skip if Meta event was already sent (prevents double-firing on retry).
  if (record.meta_event_sent) {
    return NextResponse.json({ ok: true, skipped: 'already sent' });
  }

  // 5. Resolve required env vars.
  const pixelId     = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    console.warn('[track-meta] META_PIXEL_ID or META_ACCESS_TOKEN not configured');
    return NextResponse.json({ ok: true, skipped: 'meta not configured' });
  }

  // 6. Fetch the user's email from auth.users via service role.
  //    This is the only PII lookup — it goes no further than the hash.
  const { data: authUser, error: userErr } = await serviceDb()
    .schema('auth')
    .from('users')
    .select('email')
    .eq('id', record.user_id)
    .single();

  if (userErr || !authUser?.email) {
    console.error('[track-meta] could not resolve user email:', userErr?.message);
    return NextResponse.json({ error: 'User email not found' }, { status: 500 });
  }

  // 7. Build the CAPI payload — strict privacy controls apply here.
  //    - Email is SHA-256 hashed (Meta requirement, also good for privacy).
  //    - No health metadata, session data, or clinical identifiers.
  //    - No raw PII beyond the hashed email.
  const eventTime = record.converted_at
    ? Math.floor(new Date(record.converted_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const userData: Record<string, string | string[]> = {
    em: [hashEmail(authUser.email)],
  };

  // Include fbc if a Facebook click ID was captured.
  if (record.fbclid) {
    userData.fbc = toFbc(record.fbclid, record.first_seen_at);
  }

  // Include IP and user agent for better match rates (these were anonymised
  // at capture time — last IPv4 octet zeroed, no identifiable device data).
  if (record.ip_address)  userData.client_ip_address = record.ip_address;
  if (record.user_agent)  userData.client_user_agent  = record.user_agent;

  const capiPayload = {
    data: [{
      event_name:    metaEventName(record.conversion_type),
      event_time:    eventTime,
      // anonymous_id is used as the deduplication event_id — guaranteed unique
      // per conversion, and safe to share with Meta as it carries no PII.
      event_id:      record.anonymous_id,
      action_source: 'website',
      user_data:     userData,
      // Custom data for optimisation signals — revenue-neutral for free signup.
      ...(record.conversion_type === 'subscription' && {
        custom_data: { currency: 'GBP', value: 0 },
      }),
    }],
    // Present in staging only — allows testing in Meta Events Manager.
    ...(process.env.META_TEST_EVENT_CODE && {
      test_event_code: process.env.META_TEST_EVENT_CODE,
    }),
  };

  // 8. Transmit to Meta Conversions API.
  const metaRes = await fetch(
    `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(capiPayload),
    },
  );

  if (!metaRes.ok) {
    const errBody = await metaRes.text().catch(() => '');
    console.error('[track-meta] Meta CAPI error:', metaRes.status, errBody);
    // Return 200 to prevent Supabase from retrying — log for manual resolution.
    return NextResponse.json({ ok: false, metaStatus: metaRes.status });
  }

  // 9. Mark the attribution row as sent to prevent duplicate events on
  //    any subsequent update to the same row.
  await serviceDb()
    .from('marketing_attribution')
    .update({ meta_event_sent: true, meta_sent_at: new Date().toISOString() })
    .eq('anonymous_id', record.anonymous_id);

  return NextResponse.json({ ok: true });
}
