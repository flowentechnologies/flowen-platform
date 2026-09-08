/**
 * Pure helpers behind /admin/todo's two auto-detected sections.
 *
 * Kept framework-free and side-effect-free so they're unit-testable without
 * mocking Supabase or fetch — the page fetches the raw rows, these decide
 * what counts as "needs attention."
 */

// ── Failing cron jobs ────────────────────────────────────────────────────────

export interface CronRunRow {
  job_id:     string;
  status:     string;
  error:      string | null;
  started_at: string;
}

export interface FailingJob {
  job_id:        string;
  error:         string | null;
  last_failed_at: string;
}

/**
 * Reduces a batch of cron_runs rows (any order, any mix of jobs) down to
 * "which jobs are failing right now" — defined as: the single most recent
 * run for that job_id has status 'failed'. A job that failed yesterday but
 * succeeded on its next run is NOT surfaced — this list reflects current
 * state, not history (the Cron page already covers history).
 *
 * Rows are expected most-recent-first (the page queries `order by started_at
 * desc`), but this sorts defensively rather than trusting caller order.
 */
export function findFailingJobs(rows: CronRunRow[]): FailingJob[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );

  const latestByJob = new Map<string, CronRunRow>();
  for (const row of sorted) {
    if (!latestByJob.has(row.job_id)) latestByJob.set(row.job_id, row);
  }

  return Array.from(latestByJob.values())
    .filter(row => row.status === 'failed')
    .map(row => ({ job_id: row.job_id, error: row.error, last_failed_at: row.started_at }))
    .sort((a, b) => new Date(b.last_failed_at).getTime() - new Date(a.last_failed_at).getTime());
}

// ── Stale / open pull requests ───────────────────────────────────────────────

export interface GithubPullRequest {
  number:     number;
  title:      string;
  html_url:   string;
  draft:      boolean;
  created_at: string;
}

export interface FlaggedPullRequest extends GithubPullRequest {
  age_days: number;
  stale:    boolean;
}

/**
 * Flags an open PR as "stale" once it's been open longer than `staleDays`
 * (default 3) without merging — long enough that a real PR from an active
 * session should have been merged or explicitly left as a draft on purpose,
 * short enough not to nag about same-day work-in-progress.
 */
export function flagStalePRs(
  prs: GithubPullRequest[],
  now: Date = new Date(),
  staleDays = 3,
): FlaggedPullRequest[] {
  return prs
    .map(pr => {
      const ageDays = (now.getTime() - new Date(pr.created_at).getTime()) / 86_400_000;
      return { ...pr, age_days: Math.floor(ageDays), stale: ageDays >= staleDays };
    })
    .sort((a, b) => b.age_days - a.age_days);
}
