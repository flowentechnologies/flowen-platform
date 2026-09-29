/**
 * Verified paid-purchase conversion reporting.
 *
 * The ONLY source of truth for a paid conversion is a Stripe invoice with
 * amount_paid > 0, delivered to /api/webhooks/stripe with a valid
 * signature. Browser return URLs (?success=1) are not payment proof and no
 * longer emit any purchase or Ads conversion (removed 2026-09-29).
 *
 * Exactly-once: conversion_milestones (milestone='paid_purchase',
 * external_id = invoice ID) is the idempotency key — Stripe retries, event
 * replays and duplicate webhooks all collapse to one send.
 *
 * Consent: nothing is transmitted unless the user holds a current 'all'
 * consent decision (src/lib/consent.ts — fail closed).
 */

import 'server-only';
import { createHash } from 'crypto';
import { adminDb } from '@/lib/supabase/admin';
import { hasAdsConsent } from '@/lib/consent';
import { recordMilestone } from '@/lib/analytics/milestones';
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

  // 1. Exactly-once guard. A storage error also returns no id — in that
  //    case we deliberately do NOT send, because without the durable record
  //    the next retry would double-count revenue.
  const milestone = await recordMilestone(userId, 'paid_purchase', invoiceId);
  if (!milestone.id) {
    if (milestone.error) {
      console.error('[paid-conversion] milestone insert failed:', milestone.error);
    }
    return;
  }

  // 2. Consent gate — fail closed before any identifier is read or sent.
  const consented = await hasAdsConsent({ userId });
  if (!consented) return;

  const db = adminDb();

  // 3. Attribution context (click IDs) + the email hash for enhanced matching.
  const [{ data: attr }, { data: authData }] = await Promise.all([
    db.from('marketing_attribution')
      .select('gclid, fbclid, first_seen_at, ip_address, user_agent')
      .eq('user_id', userId)
      .order('converted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);

  const email         = authData?.user?.email;
  const hashed        = email ? hashEmail(email) : undefined;
  const valueGbp      = Math.round(amountPence) / 100;
  const currencyCode  = (currency ?? 'gbp').toUpperCase();
  const eventTimeIso  = opts.paidAt ?? new Date().toISOString();

  // 4. Meta CAPI Purchase. event_id = invoice ID — deterministic, so any
  //    future browser Purchase keyed the same way deduplicates against this.
  try {
    const { data: metaProvider } = await db
      .from('tracking_providers')
      .select('pixel_id, server_config, enabled')
      .eq('provider_key', 'meta')
      .single();

    const pixelId = metaProvider?.pixel_id ?? null;
    const token   = (metaProvider?.server_config as Record<string, string> | null)?.capi_token ?? null;

    if (metaProvider?.enabled && pixelId && token) {
      const userData: Record<string, unknown> = {};
      if (hashed)            userData.em                 = [hashed];
      if (attr?.fbclid)      userData.fbc                = `fb.1.${Math.floor(new Date(attr.first_seen_at).getTime() / 1000)}.${attr.fbclid}`;
      if (attr?.ip_address)  userData.client_ip_address  = attr.ip_address;
      if (attr?.user_agent)  userData.client_user_agent  = attr.user_agent;

      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
        {
          method:  'POST',
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
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        console.error('[paid-conversion] Meta CAPI error:', res.status, errBody.slice(0, 300));
      }
    }
  } catch (err) {
    console.error('[paid-conversion] Meta send failed:', err);
  }

  // 5. Google Ads — only with a gclid to attach the conversion to.
  if (attr?.gclid) {
    const result = await uploadClickConversion({
      gclid:              attr.gclid,
      conversionDateTime: eventTimeIso,
      conversionValue:    valueGbp,
      currencyCode,
      orderId:            invoiceId,
      hashedEmail:        hashed,
    });
    if (!result.ok) {
      console.error('[paid-conversion] Google Ads upload failed:', result.error);
    }
  }
}
