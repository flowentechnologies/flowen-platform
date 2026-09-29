/**
 * Server-verifiable ad/analytics consent — the read side.
 *
 * Every cookie-banner decision is recorded through POST /api/consent into
 * consent_records, keyed by the visitor's flowen_anon_id (httpOnly cookie
 * minted by proxy.ts on first visit) and, when signed in, their user ID.
 * This module is the gate every server endpoint must pass before moving
 * any identifier toward an ad network.
 *
 * Semantics:
 *   - Latest row wins. A 'necessary' decision after an 'all' decision is a
 *     revocation and stops server-side sends immediately.
 *   - Fail closed: no row, 'necessary', or any lookup error means NO
 *     ad-purpose consent. A client-supplied consent flag (cookie, request
 *     body) is never trusted on its own.
 *   - Follows auth: a decision recorded anonymously is found via
 *     anonymous_id; after sign-in, decisions recorded under either key
 *     apply (the most recent of the two governs).
 */

import 'server-only';
import { adminDb } from '@/lib/supabase/admin';

export async function hasAdsConsent(opts: {
  anonymousId?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  const { anonymousId, userId } = opts;
  if (!anonymousId && !userId) return false;

  try {
    let query = adminDb()
      .from('consent_records')
      .select('decision, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (anonymousId && userId) {
      query = query.or(`anonymous_id.eq.${anonymousId},user_id.eq.${userId}`);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.eq('anonymous_id', anonymousId!);
    }

    const { data, error } = await query;
    if (error) {
      // Includes "table does not exist" before the migration is applied —
      // either way the answer is no consent, no ad transfer.
      console.error('[consent] lookup failed, failing closed:', error.message);
      return false;
    }
    return data?.[0]?.decision === 'all';
  } catch (err) {
    console.error('[consent] unexpected error, failing closed:', err);
    return false;
  }
}
