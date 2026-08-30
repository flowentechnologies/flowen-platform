import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe';

const COUPON_ID   = 'SOCIAL_FOLLOW_15';
const COUPON_PCT  = 15; // %
const COUPON_NAME = 'Social Follow — 15% off';

/**
 * POST /api/user/social-follow
 * Marks the user as having followed Flowen on social media and applies a
 * one-time 15% discount to their active Stripe subscription (or flags it
 * for automatic application when they subscribe).
 *
 * Idempotent: safe to call multiple times — second call is a no-op.
 *
 * R&D note: completion is recorded with a timestamp for use in engagement
 * reports submitted with HMRC R&D tax credit claims.
 */
export async function POST() {
  // ── Auth ────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = adminDb();

  // ── Idempotency check ───────────────────────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('social_follow_verified_at')
    .eq('id', user.id)
    .single();

  if (profile?.social_follow_verified_at) {
    return NextResponse.json({ ok: true, alreadyClaimed: true });
  }

  // ── Mark follow in DB ───────────────────────────────────────────────────
  const verifiedAt = new Date().toISOString();
  await admin
    .from('profiles')
    .update({ social_follow_verified_at: verifiedAt })
    .eq('id', user.id);

  // ── Apply Stripe discount ───────────────────────────────────────────────
  let discountApplied = false;
  let discountPending = false;

  try {
    const { client: stripe } = await getStripeClient();

    // Ensure the coupon exists (idempotent create)
    try {
      await stripe.coupons.retrieve(COUPON_ID);
    } catch {
      await stripe.coupons.create({
        id:                COUPON_ID,
        name:              COUPON_NAME,
        percent_off:       COUPON_PCT,
        duration:          'once',          // applies to the next invoice only
        currency:          'gbp',
        max_redemptions:   undefined,       // unlimited — each sub gets it once
      });
    }

    // Look up the Stripe customer for this user
    const { data: customer } = await admin
      .from('customers')
      .select('stripe_customer_id')
      .eq('auth_user_id', user.id)
      .single();

    if (customer?.stripe_customer_id) {
      // Find their active subscription
      const subs = await stripe.subscriptions.list({
        customer: customer.stripe_customer_id,
        status:   'active',
        limit:    1,
      });

      const sub = subs.data[0];
      if (sub) {
        // Apply discount — overwrites any existing discount on the sub
        await stripe.subscriptions.update(sub.id, {
          discounts: [{ coupon: COUPON_ID }],
        });
        discountApplied = true;
      } else {
        // No active sub yet — discount will be offered when they upgrade
        discountPending = true;
      }
    } else {
      discountPending = true;
    }
  } catch (err) {
    // Stripe failure should not block the checklist completion
    console.error('[social-follow] Stripe discount error:', err);
    discountPending = true;
  }

  return NextResponse.json({ ok: true, discountApplied, discountPending });
}
