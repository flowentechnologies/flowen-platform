import { describe, it, expect } from 'vitest';
import { deriveExpleeStage, type ExpleeThreadSignal } from './stage-mapping';

function thread(overrides: Partial<ExpleeThreadSignal> = {}): ExpleeThreadSignal {
  return { intent: null, sentCount: 1, replyCount: 0, ...overrides };
}

describe('deriveExpleeStage', () => {
  it('lands a hot lead in "in_discussion" — this is the exact gap that used to leave every new import stuck at "new" regardless of real engagement', () => {
    expect(deriveExpleeStage([thread({ intent: 'hot_lead', replyCount: 1 })])).toBe('in_discussion');
  });

  it('lands an explicit "not_interested" in "lost"', () => {
    expect(deriveExpleeStage([thread({ intent: 'not_interested', replyCount: 1 })])).toBe('lost');
  });

  it('lands a reply with no specific positive/negative classification in "contacted" — e.g. an out-of-office or email-changed autoreply', () => {
    expect(deriveExpleeStage([thread({ intent: 'out_of_office', replyCount: 1 })])).toBe('contacted');
  });

  it('lands a sent-but-no-reply-yet contact in "contacted", not "new" — they have genuinely been contacted', () => {
    expect(deriveExpleeStage([thread({ sentCount: 1, replyCount: 0 })])).toBe('contacted');
  });

  it('falls back to "new" only when there is no send at all', () => {
    expect(deriveExpleeStage([thread({ sentCount: 0, replyCount: 0 })])).toBe('new');
  });

  it('never derives "won" — that is always a human judgement call', () => {
    const stages = new Set([
      deriveExpleeStage([thread({ intent: 'hot_lead' })]),
      deriveExpleeStage([thread({ intent: 'not_interested' })]),
      deriveExpleeStage([thread({ replyCount: 5 })]),
      deriveExpleeStage([thread({ sentCount: 10 })]),
    ]);
    expect(stages.has('won')).toBe(false);
  });

  it('a hot lead in one campaign outranks a not_interested in another — the stronger commercial signal wins', () => {
    const stage = deriveExpleeStage([
      thread({ intent: 'not_interested', replyCount: 1 }),
      thread({ intent: 'hot_lead', replyCount: 1 }),
    ]);
    expect(stage).toBe('in_discussion');
  });

  it('returns "new" for an empty thread list', () => {
    expect(deriveExpleeStage([])).toBe('new');
  });
});
