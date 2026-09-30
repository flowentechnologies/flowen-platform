import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/from-request', () => ({ getUserFromRequest: async () => ({ id: 'test-user' }) }));
vi.mock('@/lib/rate-limit', () => ({ checkAiRateLimit: async () => true }));
vi.mock('@/lib/anthropic', () => ({ requireAnthropicKey: () => null, getAnthropicClient: () => { throw new Error('AI must not be called for invalid input'); } }));
import { POST as sessionPost } from './sessions/route';
import { POST as coachPost } from './coach/route';
function request(body: unknown) {
  return new Request('https://example.invalid/api/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
describe('practice request shape', () => {
  it.each([null, [], 'text', 42, true])('session rejects non-object JSON %s', async body => {
    expect((await sessionPost(request(body))).status).toBe(400);
  });
  it.each([null, [], 'text', 42, true])('coach rejects non-object JSON %s', async body => {
    expect((await coachPost(request(body))).status).toBe(400);
  });
  it.each([{}, { stageId: 2, transcript: [], sessionElapsed: 10 }, { stageId: 9, transcript: '', sessionElapsed: 10 }, { stageId: 2, transcript: '', sessionElapsed: -1 }, { stageId: 2, transcript: '', sessionElapsed: 10, lastCoachResponse: {} }])('coach rejects invalid fields %s', async body => {
    expect((await coachPost(request(body))).status).toBe(400);
  });
});
