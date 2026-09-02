/**
 * /api/track/capi
 *
 * Real-time Meta + Snapchat Conversions API bridge for mid-funnel browser
 * events. Called by pixel.ts helpers alongside the client-side fbq()/
 * snaptr() calls so that every pixel event is also sent server-side with
 * the same event_id.
 *
 * Both platforms deduplicate on event_id: if the browser pixel and this
 * route report the same event, only one is counted in Events Manager.
 * Snap has no clean equivalent for 'Lead', so that event is Meta-only.
 *
 * Config: pixel_id and capi_token are read from tracking_providers
 * (set via /admin/tracking — same source as the conversion webhook).
 *
 * Testing: Meta uses META_TEST_EVENT_CODE (a field in the request body).
 * Snap has no such field — its test mode is a separate endpoint
 * (/events/validate instead of /events), toggled here via
 * SNAP_CAPI_VALIDATE=true. See the Snap block below for details.
 *
 * Privacy contract:
 *   Only hashed email (SHA-256), click IDs, IP, and user-agent are
 *   forwarded. No clinical data, session content, or raw PII.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/supabase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'StartTrial'
  | 'CompleteRegistration'
  | 'Subscribe';

interface CAPIRequest {
  event_name:  MetaEventName;
  event_id:    string;          // UUID generated client-side; must match the fbq() call
  custom_data?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/** fb.1.{ts}.{fbclid} — Meta's standard fbc cookie format */
function toFbc(fbclid: string, seenAt: string): string {
  return `fb.1.${Math.floor(new Date(seenAt).getTime() / 1000)}.${fbclid}`;
}

/**
 * Meta event name → Snap Pixel standard event name.
 * Only events with a clean Snap equivalent are forwarded — see pixel.ts
 * for the matching client-side map.
 */
const SNAP_EVENT_MAP: Partial<Record<MetaEventName, string>> = {
  PageView:             'PAGE_VIEW',
  ViewContent:          'VIEW_CONTENT',
  InitiateCheckout:     'ADD_CART',
  Purchase:             'PURCHASE',
  StartTrial:           'START_TRIAL',
  CompleteRegistration: 'SIGN_UP',
  Subscribe:            'SUBSCRIBE',
};

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CAPIRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event_name, event_id, custom_data } = body;
  if (!event_name || !event_id) {
    return NextResponse.json({ error: 'event_name and event_id required' }, { status: 400 });
  }

  // 1. Read Meta config from tracking_providers
  const { data: provider } = await adminDb()
    .from('tracking_providers')
    .select('pixel_id, server_config, enabled')
    .eq('provider_key', 'meta')
    .single();

  const pixelId       = provider?.pixel_id ?? null;
  const capiToken     = (provider?.server_config as Record<string, string> | null)?.capi_token ?? null;
  const metaConfigured = Boolean(provider?.enabled && pixelId && capiToken);

  // 2. Build user_data — hashed email when authenticated, always IP + UA
  // (shared by both providers below, so this runs even if Meta isn't configured)
  const userData: Record<string, unknown> = {};

  // IP address from Vercel/proxy headers
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? req.headers.get('x-real-ip')
          ?? null;
  const ua = req.headers.get('user-agent');
  if (ip) userData.client_ip_address = ip;
  if (ua) userData.client_user_agent  = ua;

  // Session user email (optional — not all events are from authenticated users)
  try {
    const cookieStore = await cookies();
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user } } = await ssr.auth.getUser();
    if (user?.email) {
      userData.em = [sha256(user.email)];
    }
  } catch {
    // Session unavailable — continue without email
  }

  // 3. fbclid → fbc from marketing_attribution via anonymous_id cookie
  try {
    const cookieStore = await cookies();
    const anonId = cookieStore.get('flowen_anon_id')?.value;
    if (anonId) {
      const { data: attr } = await adminDb()
        .from('marketing_attribution')
        .select('fbclid, first_seen_at')
        .eq('anonymous_id', anonId)
        .not('fbclid', 'is', null)
        .maybeSingle();
      if (attr?.fbclid) {
        userData.fbc = toFbc(attr.fbclid, attr.first_seen_at);
      }
    }
  } catch {
    // Attribution lookup failed — continue without fbc
  }

  // 4. Send to Meta CAPI (skipped — not returned early — if not configured,
  //    so Snapchat below still runs independently)
  let metaOk = true; // no-op default when Meta isn't configured
  if (metaConfigured) {
    const capiPayload = {
      data: [{
        event_name,
        event_time:    Math.floor(Date.now() / 1000),
        event_id,
        action_source: 'website',
        user_data:     userData,
        ...(custom_data && { custom_data }),
      }],
      ...(process.env.META_TEST_EVENT_CODE && {
        test_event_code: process.env.META_TEST_EVENT_CODE,
      }),
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${capiToken}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(capiPayload),
      },
    );

    metaOk = metaRes.ok;
    if (!metaOk) {
      const errBody = await metaRes.text().catch(() => '');
      console.error('[capi] Meta error:', metaRes.status, errBody);
    }
  }

  // 5. Send to Snapchat CAPI (independent of Meta — never blocks the response)
  const snapEventName = SNAP_EVENT_MAP[event_name];
  if (snapEventName) {
    try {
      const { data: snapProvider } = await adminDb()
        .from('tracking_providers')
        .select('pixel_id, server_config, enabled')
        .eq('provider_key', 'snapchat')
        .single();

      const snapPixelId = snapProvider?.pixel_id ?? null;
      const snapToken   = (snapProvider?.server_config as Record<string, string> | null)?.capi_token ?? null;

      if (snapProvider?.enabled && snapPixelId && snapToken) {
        const snapUserData: Record<string, unknown> = {};
        if (ip) snapUserData.client_ip_address = ip;
        if (ua) snapUserData.user_agent = ua;
        if (userData.em) snapUserData.em = userData.em; // reuse hash already computed above

        const snapPayload = {
          data: [{
            event_name:        snapEventName,
            action_source:     'website',
            event_source_url:  req.headers.get('referer') ?? 'https://flowen.digital',
            event_time:        Math.floor(Date.now() / 1000),
            user_data:         snapUserData,
            custom_data:       { event_id, ...(custom_data ?? {}) },
          }],
        };

        // SNAP_CAPI_VALIDATE=true routes to Snap's /events/validate endpoint
        // instead of the live /events one — same request shape, but Snap
        // returns a { status: 'VALID' | 'INVALID', event_logs, errors }
        // body instead of ingesting the event, and the event also then
        // shows up under Events Manager → Test Events → Conversions API.
        // Unset (the production default), behavior is unchanged.
        const snapValidate = process.env.SNAP_CAPI_VALIDATE === 'true';
        const snapPath      = snapValidate ? 'events/validate' : 'events';

        const snapRes = await fetch(
          `https://tr.snapchat.com/v3/${snapPixelId}/${snapPath}?access_token=${snapToken}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(snapPayload),
          },
        );

        if (snapValidate) {
          const validateBody = await snapRes.text().catch(() => '');
          console.log('[capi] Snapchat validate response:', snapRes.status, validateBody);
        } else if (!snapRes.ok) {
          const errBody = await snapRes.text().catch(() => '');
          console.error('[capi] Snapchat error:', snapRes.status, errBody);
        }
      }
    } catch (err) {
      console.error('[capi] Snapchat send failed:', err);
    }
  }

  return NextResponse.json({ ok: metaOk }, { status: 200 }); // 200 so client doesn't surface errors
}
