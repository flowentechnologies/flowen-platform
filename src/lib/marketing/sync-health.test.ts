import { describe, it, expect } from 'vitest';
import { findFailingSyncPlatforms, latestRunPerJob } from './sync-health';

describe('latestRunPerJob', () => {
  it('keeps only the first (most recent) row per job_id', () => {
    const rows = [
      { job_id: 'marketing-sync-google', status: 'failed', error: 'new error' },
      { job_id: 'marketing-sync-meta', status: 'success', error: null },
      { job_id: 'marketing-sync-google', status: 'success', error: null }, // older, same job — dropped
    ];
    expect(latestRunPerJob(rows)).toEqual([
      { job_id: 'marketing-sync-google', status: 'failed', error: 'new error' },
      { job_id: 'marketing-sync-meta', status: 'success', error: null },
    ]);
  });

  it('returns an empty array for no rows', () => {
    expect(latestRunPerJob([])).toEqual([]);
  });
});

describe('findFailingSyncPlatforms', () => {
  it('reports a platform whose latest run failed, by name and error', () => {
    const result = findFailingSyncPlatforms([
      { job_id: 'marketing-sync-google', status: 'failed', error: 'Google token refresh failed: The OAuth client was not found.' },
      { job_id: 'marketing-sync-meta', status: 'success', error: null },
    ]);
    expect(result).toEqual([
      { platform: 'google', error: 'Google token refresh failed: The OAuth client was not found.' },
    ]);
  });

  it('reports nothing when every platform\'s latest run succeeded — the regression this exists to catch: a failing platform must not stay silent just because a sibling platform is healthy', () => {
    const result = findFailingSyncPlatforms([
      { job_id: 'marketing-sync-google', status: 'success', error: null },
      { job_id: 'marketing-sync-meta', status: 'success', error: null },
    ]);
    expect(result).toEqual([]);
  });

  it('reports every platform that is failing, not just the first', () => {
    const result = findFailingSyncPlatforms([
      { job_id: 'marketing-sync-google', status: 'failed', error: 'a' },
      { job_id: 'marketing-sync-meta', status: 'failed', error: 'b' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('ignores non-marketing-sync job_ids and non-"failed" statuses', () => {
    expect(findFailingSyncPlatforms([{ job_id: 'social-stats-sync', status: 'failed', error: 'x' }])).toEqual([]);
    expect(findFailingSyncPlatforms([{ job_id: 'marketing-sync-google', status: 'running', error: null }])).toEqual([]);
  });
});
