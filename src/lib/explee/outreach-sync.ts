/**
 * Pure decision helpers for explee-outreach-sync, extracted for unit testing
 * without mocking Supabase/Explee network calls.
 *
 * Two real bugs this backs:
 *
 *   - The route used to upsert a contact's latest_sent_at/latest_reply_at in
 *     the same pass that *decided* whether to fetch that contact's message
 *     thread. If the run then ran out of time — or the thread fetch itself
 *     failed — before the thread was actually fetched and stored, the next
 *     run's "did this contact change?" check compared against the value
 *     already persisted, which now matched, so it silently gave up on that
 *     thread forever. The route now fetches the thread strictly before
 *     persisting a changed contact's latest_* fields, so an interrupted or
 *     failed fetch always retries on the next run.
 *   - Runs were purely sequential per-campaign/-contact with no notion of
 *     Vercel's 300s function ceiling, so successful runs already sat at
 *     230-299s and any growth in campaign/contact volume pushed some runs
 *     into an outright HTTP 504. hasTimeBudget() lets the route stop
 *     cleanly with a partial result well before the ceiling, instead of
 *     being truncated mid-write.
 *   - isContactChanged compared the two timestamps as raw strings. `prior`
 *     comes back from PostgREST (a timestamptz column, serialized with a
 *     `+00:00` offset); `current` comes straight off Explee's own JSON
 *     (`Z`-suffixed). Same instant, different string, every time — so
 *     every contact compared "changed" on every single run, forever, once
 *     it had ever been synced once. Confirmed live: 1,164/1,164 contacts
 *     "changed" on 10 consecutive runs — the fast/cheap path this was
 *     built for never actually ran. Fixed by comparing parsed instants.
 */

export interface ContactSyncState {
  latest_sent_at: string | null;
  latest_reply_at: string | null;
}

/** Epoch millis for a timestamp string, or null for a genuinely absent one — never NaN. */
function toInstant(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Has anything on this thread moved since the last successful sync? */
export function isContactChanged(prior: ContactSyncState | undefined, current: ContactSyncState): boolean {
  return !prior
    || toInstant(prior.latest_sent_at) !== toInstant(current.latest_sent_at)
    || toInstant(prior.latest_reply_at) !== toInstant(current.latest_reply_at);
}

/** True while there's still enough runway to safely start more work this run. */
export function hasTimeBudget(startedAt: number, budgetMs: number, now: number = Date.now()): boolean {
  return now - startedAt < budgetMs;
}
