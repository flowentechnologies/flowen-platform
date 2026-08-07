/**
 * POST /api/affiliate/convert
 *
 * Internal server-side endpoint to record an affiliate conversion and
 * auto-create a commission line item.
 *
 * Callers:
 *   - Auth callback (signup) — fires after Supabase confirms the new user
 *   - Stripe webhook handler — fires on checkout.session.completed
 *   - Onboarding completion server action
 *
 * The caller passes the referral code (read from the `flowen_ref` cookie),
 * the event type, and optionally the revenue amount. This endpoint is
 * internal-only — it requires the INTERNAL_API_SECRET header to prevent
 * abuse from the public internet.
 *
 * Commission calculation:
 *   commission_pence = round(amount_pence × commission_pct / 100)
 *   Only created when amount_pence > 0.
 *
 * Idempotency:
 *   Duplicate conversions for the same referred_user_id + event_type are
 *   skipped silently (upsert on conflict). This prevents double-commissions
 *   from webhook retries.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function isAuthorized(req: Request): boolean {
  // Internal secret — set INTERNAL_API_SECRET in env.
  // Falls back to allowing server-side calls on localhost in dev.
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('x-internal-secret') === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    ref_code:         string;          // affiliate referral code from flowen_ref cookie
    event_type?:      'signup' | 'subscription' | 'renewal';
    referred_user_id?: string;         // auth.users id of the converted user
    subscription_id?: string;          // Stripe subscription id
    amount_pence?:    number;          // revenue that triggered the conversion
    notes?:           string;
  };

  const { ref_code, event_type = 'signup', referred_user_id, subscription_id, amount_pence, notes } = body;

  if (!ref_code) return NextResponse.json({ error: 'ref_code required' }, { status: 400 });

  const client = db();

  // 1. Resolve affiliate by code — must be active
  const { data: affiliate } = await client
    .from('affiliates')
    .select('id, commission_pct, status')
    .eq('code', ref_code.toUpperCase().trim())
    .eq('status', 'active')
    .maybeSingle();

  if (!affiliate) {
    return NextResponse.json({ skipped: true, reason: 'affiliate not found or inactive' });
  }

  // 2. Idempotency — skip if this user + event already recorded
  if (referred_user_id) {
    const { data: existing } = await client
      .from('affiliate_conversions')
      .select('id')
      .eq('affiliate_id', affiliate.id)
      .eq('referred_user_id', referred_user_id)
      .eq('event_type', event_type)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ skipped: true, reason: 'duplicate conversion' });
    }
  }

  // 3. Insert conversion
  const { data: conversion, error: convErr } = await client
    .from('affiliate_conversions')
    .insert({
      affiliate_id:     affiliate.id,
      referred_user_id: referred_user_id ?? null,
      event_type,
      subscription_id:  subscription_id  ?? null,
      amount_pence:     amount_pence      ?? null,
      notes:            notes             ?? null,
    })
    .select()
    .single();

  if (convErr) return NextResponse.json({ error: convErr.message }, { status: 400 });

  // 4. Auto-create commission if revenue provided
  let commission = null;
  if (amount_pence && amount_pence > 0) {
    const commAmt = Math.round(amount_pence * (affiliate.commission_pct / 100));
    const { data: comm } = await client
      .from('affiliate_commissions')
      .insert({
        affiliate_id:  affiliate.id,
        conversion_id: conversion.id,
        amount_pence:  commAmt,
        description:   `${affiliate.commission_pct}% of ${event_type} (£${(amount_pence / 100).toFixed(2)})`,
      })
      .select()
      .single();
    commission = comm;
  }

  return NextResponse.json({
    ok:          true,
    conversion,
    commission,
    affiliate_id: affiliate.id,
  });
}
