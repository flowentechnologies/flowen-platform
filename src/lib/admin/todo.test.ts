import { describe, it, expect } from 'vitest';
import { findFailingJobs, flagStalePRs, type CronRunRow, type GithubPullRequest } from './todo';

describe('findFailingJobs', () => {
  it('surfaces a job whose most recent run failed', () => {
    const rows: CronRunRow[] = [
      { job_id: 'backup', status: 'failed', error: 'boom', started_at: '2026-09-08T06:00:00Z' },
    ];
    expect(findFailingJobs(rows)).toEqual([
      { job_id: 'backup', error: 'boom', last_failed_at: '2026-09-08T06:00:00Z' },
    ]);
  });

  it('does not surface a job that failed before but has since recovered', () => {
    const rows: CronRunRow[] = [
      { job_id: 'backup', status: 'success', error: null, started_at: '2026-09-08T06:00:00Z' },
      { job_id: 'backup', status: 'failed', error: 'boom', started_at: '2026-09-07T06:00:00Z' },
    ];
    expect(findFailingJobs(rows)).toEqual([]);
  });

  it('only counts the single most recent run per job, regardless of row order', () => {
    // Deliberately out of order — the function must sort, not trust input order.
    const rows: CronRunRow[] = [
      { job_id: 'marketing-sync-google', status: 'failed', error: 'old error', started_at: '2026-09-05T06:00:00Z' },
      { job_id: 'marketing-sync-google', status: 'failed', error: 'new error', started_at: '2026-09-08T06:00:00Z' },
      { job_id: 'gmail-sync', status: 'success', error: null, started_at: '2026-09-08T09:00:00Z' },
    ];
    const result = findFailingJobs(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      job_id: 'marketing-sync-google',
      error: 'new error',
      last_failed_at: '2026-09-08T06:00:00Z',
    });
  });

  it('handles multiple distinct failing jobs, most recent failure first', () => {
    const rows: CronRunRow[] = [
      { job_id: 'a', status: 'failed', error: 'a-err', started_at: '2026-09-06T00:00:00Z' },
      { job_id: 'b', status: 'failed', error: 'b-err', started_at: '2026-09-08T00:00:00Z' },
    ];
    expect(findFailingJobs(rows).map(j => j.job_id)).toEqual(['b', 'a']);
  });

  it('returns an empty list when nothing is failing', () => {
    const rows: CronRunRow[] = [
      { job_id: 'backup', status: 'success', error: null, started_at: '2026-09-08T06:00:00Z' },
    ];
    expect(findFailingJobs(rows)).toEqual([]);
  });

  it('returns an empty list for no rows at all', () => {
    expect(findFailingJobs([])).toEqual([]);
  });
});

describe('flagStalePRs', () => {
  const now = new Date('2026-09-08T12:00:00Z');

  it('does not flag a PR opened today', () => {
    const prs: GithubPullRequest[] = [
      { number: 1, title: 'fresh', html_url: 'x', draft: false, created_at: '2026-09-08T09:00:00Z' },
    ];
    expect(flagStalePRs(prs, now)[0].stale).toBe(false);
  });

  it('flags a PR open for exactly the stale threshold', () => {
    const prs: GithubPullRequest[] = [
      { number: 1, title: 'aging', html_url: 'x', draft: true, created_at: '2026-09-05T12:00:00Z' },
    ];
    expect(flagStalePRs(prs, now, 3)[0].stale).toBe(true);
    expect(flagStalePRs(prs, now, 3)[0].age_days).toBe(3);
  });

  it('does not flag a PR just under the threshold', () => {
    const prs: GithubPullRequest[] = [
      { number: 1, title: 'almost', html_url: 'x', draft: true, created_at: '2026-09-06T00:00:00Z' },
    ];
    expect(flagStalePRs(prs, now, 3)[0].stale).toBe(false);
  });

  it('sorts by age, oldest first', () => {
    const prs: GithubPullRequest[] = [
      { number: 1, title: 'young', html_url: 'x', draft: false, created_at: '2026-09-07T12:00:00Z' },
      { number: 2, title: 'old', html_url: 'x', draft: true, created_at: '2026-09-01T12:00:00Z' },
    ];
    expect(flagStalePRs(prs, now).map(p => p.number)).toEqual([2, 1]);
  });

  it('respects a custom staleDays threshold', () => {
    const prs: GithubPullRequest[] = [
      { number: 1, title: 'a', html_url: 'x', draft: true, created_at: '2026-09-07T12:00:00Z' },
    ];
    expect(flagStalePRs(prs, now, 1)[0].stale).toBe(true);
    expect(flagStalePRs(prs, now, 7)[0].stale).toBe(false);
  });
});
