/**
 * Authoritative, idempotent business-milestone recorder.
 *
 * One row per (milestone, external_id) in conversion_milestones. The id is
 * returned only when THIS call inserted the row — callers treat a non-null
 * id as "first time, fire the event", which makes every downstream
 * analytics event exactly-once per milestone regardless of retries,
 * replays, double submissions, or multi-device logins.
 *
 *   signup              external_id = user_id
 *   onboarding_complete external_id = user_id
 *   paid_purchase       external_id = Stripe invoice ID
 *
 * The milestone id doubles as the browser/server dedup key: /auth/callback
 * hands it to the browser (one-shot cookie) and writes it onto the bridged
 * attribution row, so the browser Meta event and the server CAPI send share
 * one event_id and the platforms count one conversion, not two.
 */

import 'server-only';
import { adminDb } from '@/lib/supabase/admin';

export type Milestone = 'signup' | 'onboarding_complete' | 'paid_purchase';

export async function recordMilestone(
  userId: string,
  milestone: Milestone,
  externalId: string,
): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await adminDb()
    .from('conversion_milestones')
    .insert({ user_id: userId, milestone, external_id: externalId })
    .select('id');

  if (error) {
    // Unique violation (23505) = already recorded — legitimately not new.
    if (error.code === '23505') return { id: null };
    // Anything else (e.g. table missing pre-migration) must not fire events
    // either — a milestone that cannot be persisted cannot be exactly-once.
    console.error('[milestones] insert failed:', error.message);
    return { id: null, error: error.message };
  }
  return { id: (data?.[0]?.id as string | undefined) ?? null };
}
