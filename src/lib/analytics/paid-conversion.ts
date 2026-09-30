/**
 * Verified paid-purchase conversion reporting.
 *
 * The ONLY source of truth for a paid conversion is a Stripe invoice with
 * amount_paid > 0, delivered to /api/webhooks/stripe with a valid
 * signature. Browser return URLs (?success=1) are not payment proof and no
 * longer emit any purchase or Ads conversion (removed 2026-09-29).
 *
 * Per-destination durable delivery claims survive Stripe retries. Platform
 * dedup keys are the invoice ID. Remote acceptance and local completion are
 * not atomic; no exactly-once network guarantee is claimed.
 *
 * Consent: nothing is transmitted unless the user holds a current 'all'
 * consent decision (src/lib/consent.ts — fail closed).
 */

import 'server-only';
import { createHash } from 'crypto';
import { adminDb } from '@/lib/supabase/admin';
import { hasAdsConsent } from '@/lib/consent';
import { deliverConversion } from '@/lib/analytics/conversion-delivery';
import { buildGa4Purchase } from '@/lib/analytics/ga4-purchase';
import { uploadClickConversion } from '@/lib/google-ads-conversions';

function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

export async function reportPaidPurchase(opts: {
  userId: string;
  invoiceId: string;
  amountPence: number;
  currency: string;
  paidAt?: string; // ISO
}): Promise<void> {
  const { userId, invoiceId, amountPence, currency } = opts;
  if (!invoiceId || amountPence <= 0) return;

  const db = adminDb();
  // Recover the trusted anonymous binding captured by the authenticated route.
  // Banner consent may have happened before sign-in; latest decision under
  // either identity governs, including a later anonymous revocation.
  const { data: boundIdentity, error: bindingError } = await db.from('analytics_identities')
    .select('anonymous_id').eq('user_id', userId).order('captured_at', { ascending: false }).limit(1).maybeSingle();
  if (bindingError) throw new Error('Purchase consent binding lookup failed');
  if (!(await hasAdsConsent({ userId, anonymousId: boundIdentity?.anonymous_id }))) return;

  // 3. Attribution context (click IDs) + the email hash for enhanced matching.
  const [{ data: attr, error: attrError }, { data: authData, error: authError }] = await Promise.all([
    db.from('marketing_attribution')
      .select('gclid, fbclid, first_seen_at, ip_address, user_agent')
      .eq('user_id', userId)
      .order('converted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);

  if (attrError || authError) throw new Error('Purchase attribution lookup failed');

  const email         = authData?.user?.email;
  const hashed        = email ? hashEmail(email) : undefined;
  const valueGbp      = Math.round(amountPence) / 100;
  const currencyCode  = (currency ?? 'gbp').toUpperCase();
  const eventTimeIso  = opts.paidAt ?? new Date().toISOString();

  // 4. Meta CAPI Purchase. event_id = invoice ID — deterministic, so any
  //    future browser Purchase keyed the same way deduplicates against this.
  const failures: string[] = [];
  try {
    const { data: metaProvider, error: metaError } = await db
      .from('tracking_providers')
      .select('pixel_id, server_config, enabled')
      .eq('provider_key', 'meta')
      .single();

    if (metaError) throw new Error('Meta provider lookup failed');
    const pixelId = metaProvider?.pixel_id ?? null;
    const token   = (metaProvider?.server_config as Record<string, string> | null)?.capi_token ?? null;

    if (metaProvider?.enabled && (!pixelId || !token)) throw new Error('Meta configuration missing');
    if (metaProvider?.enabled && pixelId && token) {
      const userData: Record<string, unknown> = {};
      if (hashed)            userData.em                 = [hashed];
      if (attr?.fbclid)      userData.fbc                = `fb.1.${Math.floor(new Date(attr.first_seen_at).getTime() / 1000)}.${attr.fbclid}`;
      if (attr?.ip_address)  userData.client_ip_address  = attr.ip_address;
      if (attr?.user_agent)  userData.client_user_agent  = attr.user_agent;

      await deliverConversion(invoiceId, 'meta', userId, async () => {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
        {
          method:  'POST',
          signal: AbortSignal.timeout(10_000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [{
              event_name:    'Purchase',
              event_time:    Math.floor(new Date(eventTimeIso).getTime() / 1000),
              event_id:      invoiceId,
              action_source: 'website',
              user_data:     userData,
              custom_data:   { currency: currencyCode, value: valueGbp, order_id: invoiceId },
            }],
          }),
        },
      );
      if (!res.ok) throw new Error('Meta rejected purchase');
      const result = await res.json();
      if (result.events_received !== 1) throw new Error('Meta did not acknowledge purchase');
      });
    }
  } catch { failures.push('meta'); }

  // 5. Google Ads — only with a gclid to attach the conversion to.
  if (attr?.gclid) {
    try { await deliverConversion(invoiceId, 'google_ads', userId, async () => {
    const result = await uploadClickConversion({
      gclid:              attr.gclid,
      conversionDateTime: eventTimeIso,
      conversionValue:    valueGbp,
      currencyCode,
      orderId:            invoiceId,
      hashedEmail:        hashed,
    });
    if (!result.ok) throw new Error('Google Ads rejected purchase');
    }); } catch { failures.push('google_ads'); }
  }

  // 6. GA4 paid invoice, joined to the real consented browser client ID.
  try {
    const { data: provider, error: providerError } = await db.from('tracking_providers')
      .select('pixel_id, enabled').eq('provider_key', 'ga4').maybeSingle();
    if (providerError) throw new Error('GA4 provider lookup failed');
    if (provider?.enabled && provider.pixel_id) {
      const secret = process.env.GA4_API_SECRET;
      if (!secret) throw new Error('GA4 secret missing');
      const { data: identity, error: identityError } = await db.from('analytics_identities')
        .select('client_id, session_id, captured_at, anonymous_id')
        .eq('user_id', userId).eq('measurement_id', provider.pixel_id).maybeSingle();
      if (identityError) throw new Error('GA4 identity lookup failed');
      if (identity && await hasAdsConsent({ userId, anonymousId: identity.anonymous_id })) {
        const body = buildGa4Purchase(identity, invoiceId, amountPence, currencyCode, eventTimeIso);
        if (!body) throw new Error('GA4 purchase outside valid time window');
        await deliverConversion(invoiceId, 'ga4', userId, async () => {
          const url = new URL('https://www.google-analytics.com/mp/collect');
          url.searchParams.set('measurement_id', provider.pixel_id);
          url.searchParams.set('api_secret', secret);
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
          // MP HTTP success proves transport only; it is NOT reporting acceptance.
          if (!res.ok) throw new Error('GA4 transport failed');
        });
      } // No real client ID: skip, never invent one or falsely attach a session.
    }
  } catch { failures.push('ga4'); }
  if (failures.length) throw new Error(`Paid conversion retry required: ${failures.join(',')}`);
}
