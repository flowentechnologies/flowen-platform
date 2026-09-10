import { describe, it, expect } from 'vitest';
import { isContactChanged, hasTimeBudget } from './outreach-sync';

describe('isContactChanged', () => {
  it('is changed when there is no prior row — first time we have seen this contact', () => {
    expect(isContactChanged(undefined, { latest_sent_at: '2026-09-01', latest_reply_at: null })).toBe(true);
  });

  it('is changed when latest_sent_at moved', () => {
    const prior = { latest_sent_at: '2026-09-01', latest_reply_at: null };
    expect(isContactChanged(prior, { latest_sent_at: '2026-09-05', latest_reply_at: null })).toBe(true);
  });

  it('is changed when latest_reply_at moved', () => {
    const prior = { latest_sent_at: '2026-09-01', latest_reply_at: null };
    expect(isContactChanged(prior, { latest_sent_at: '2026-09-01', latest_reply_at: '2026-09-06' })).toBe(true);
  });

  it('is not changed when neither timestamp moved — this is the exact bug: the route used to persist the new timestamps before fetching the thread, so a re-run would see this as false and skip forever', () => {
    const prior = { latest_sent_at: '2026-09-01', latest_reply_at: '2026-09-02' };
    expect(isContactChanged(prior, { latest_sent_at: '2026-09-01', latest_reply_at: '2026-09-02' })).toBe(false);
  });
});

describe('hasTimeBudget', () => {
  it('has budget when no time has elapsed', () => {
    expect(hasTimeBudget(1000, 5000, 1000)).toBe(true);
  });

  it('has budget just under the ceiling', () => {
    expect(hasTimeBudget(1000, 5000, 5999)).toBe(true);
  });

  it('is out of budget exactly at the ceiling', () => {
    expect(hasTimeBudget(1000, 5000, 6000)).toBe(false);
  });

  it('is out of budget past the ceiling', () => {
    expect(hasTimeBudget(1000, 5000, 9000)).toBe(false);
  });
});
