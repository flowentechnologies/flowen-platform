/**
 * Resolves the "source" bucket for the Attribution tab's traffic-by-source
 * breakdown: the real utm_source when present, otherwise inferred from
 * whichever ad-network click ID is on record.
 *
 * Extracted specifically to pin down a real bug found and fixed in
 * src/app/api/admin/marketing/route.ts: the inline version read
 * `r.utm_source ?? r.fbclid ? 'meta' : r.gclid ? 'google' : 'direct'`.
 * `??` binds tighter than `? :`, so that parsed as
 * `(r.utm_source ?? r.fbclid) ? 'meta' : ...` — any row with a truthy
 * utm_source (e.g. 'google') got bucketed as 'meta' regardless of its
 * actual value, since the condition only checked truthiness, never the
 * value itself.
 */
export function resolveAttributionSource(
  utmSource: string | null,
  fbclid: string | null,
  gclid: string | null,
): string {
  return utmSource ?? (fbclid ? 'meta' : gclid ? 'google' : 'direct');
}
