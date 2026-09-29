/**
 * Marketing attribution bridge — server-side only.
 *
 * Responsible for linking an anonymous attribution record (written by proxy.ts
 * when the user first arrives via an ad click) to a verified Supabase user_id
 * once the visitor authenticates.
 *
 * Deliberately kept as a single, focused module so it can be imported by both
 * Server Actions (login/signup flows) and Route Handlers (magic-link callback)
 * without pulling in heavy framework dependencies.
 */

import 'server-only';
import { adminDb } from '@/lib/supabase/admin';

// ── Service-role Supabase client ──────────────────────────────────────────────
// Singleton from lib/supabase/admin — RLS bypassed, reused across warm instances.
const serviceDb = adminDb;

export type ConversionType = 'signup' | 'subscription' | 'trial';

// ── bridgeAttribution ─────────────────────────────────────────────────────────

/**
 * Links an anonymous attribution record to an authenticated user.
 *
 * Called only from /auth/callback after a verified NEW-signup milestone
 * (2026-09-29). It must NOT be called on ordinary logins: bridging a
 * returning user's fresh ad click made them look like a new signup
 * conversion. If the visitor arrived via an ad click, the proxy will have
 * already inserted
 * a row in marketing_attribution keyed on anonymous_id. This function sets the
 * user_id on that row, which is what triggers the Supabase DB webhook that
 * forwards the conversion to Meta CAPI / Google Ads Enhanced Conversions.
 *
 * Safe to call speculatively — if anonId is absent, or no matching row exists
 * (direct sign-up with no prior ad click), or the row was already bridged on
 * a previous login, this is a no-op.
 *
 * The `.is('user_id', null)` guard ensures a re-login never re-fires a
 * conversion event for an existing subscriber.
 */
export async function bridgeAttribution(
  anonId: string | undefined | null,
  userId: string,
  conversionType: ConversionType = 'signup',
  signupEventId?: string,
): Promise<void> {
  // Nothing to bridge if the cookie was never set (no ad click on record).
  if (!anonId) return;

  const { error } = await serviceDb()
    .from('marketing_attribution')
    .update({
      user_id:         userId,
      converted_at:    new Date().toISOString(),
      conversion_type: conversionType,
      // Browser/server dedup key for the signup event (2026-09-29): the
      // milestone id handed to the browser via the flowen_signup_event
      // cookie, so the browser Meta event and the server CAPI send share
      // one event_id and the platform counts one conversion.
      ...(signupEventId && { signup_event_id: signupEventId }),
    })
    .eq('anonymous_id', anonId)
    .is('user_id', null); // Idempotency guard — bridge at most once per attribution row.

  if (error) {
    // Non-fatal — log but never throw. A failed attribution bridge must not
    // disrupt the user's login/signup flow.
    console.error('[attribution] bridge failed:', error.message);
  }
}
