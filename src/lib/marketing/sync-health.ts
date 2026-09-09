/**
 * Which ad-platform sync jobs are currently failing, pulled out of
 * consistency-checks.ts's checkMarketing() specifically so a genuinely
 * broken platform (Google Ads' OAuth client going invalid, say) gets its
 * own accurate, ongoing call-out instead of hiding behind a healthy
 * sibling platform. checkMarketing()'s "no ad platform data synced at
 * all" check only fires when EVERY platform is silent — with Meta still
 * syncing successfully, a Google-only failure never re-surfaced past the
 * one-off notification from the day both happened to be down together.
 */
export interface LatestSyncRun {
  job_id: string;             // e.g. 'marketing-sync-google'
  status: string;             // cron_runs.status
  error: string | null;
}

export interface FailingSyncPlatform {
  platform: string;           // job_id with the 'marketing-sync-' prefix stripped
  error: string | null;
}

const JOB_PREFIX = 'marketing-sync-';

/**
 * `latestRuns` should already be reduced to one row per job_id (the most
 * recent by started_at) — this makes no assumption about ordering itself,
 * so a caller passing unreduced history would silently double-count a
 * platform that failed once and later recovered.
 */
export function findFailingSyncPlatforms(latestRuns: LatestSyncRun[]): FailingSyncPlatform[] {
  return latestRuns
    .filter(r => r.job_id.startsWith(JOB_PREFIX) && r.status === 'failed')
    .map(r => ({ platform: r.job_id.slice(JOB_PREFIX.length), error: r.error }));
}

/** One row per job_id, keeping only the first (most recent) occurrence — pass rows already ordered by started_at desc. */
export function latestRunPerJob(runsDescByStartedAt: LatestSyncRun[]): LatestSyncRun[] {
  const seen = new Set<string>();
  const out: LatestSyncRun[] = [];
  for (const run of runsDescByStartedAt) {
    if (seen.has(run.job_id)) continue;
    seen.add(run.job_id);
    out.push(run);
  }
  return out;
}
