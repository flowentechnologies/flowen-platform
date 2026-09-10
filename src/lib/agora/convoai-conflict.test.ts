import { describe, it, expect } from 'vitest';
import { conflictingAgentId } from './convoai-conflict';

describe('conflictingAgentId', () => {
  it('extracts the blocking agent id from a real TaskConflict response', () => {
    expect(conflictingAgentId(409, {
      agent_id: 'A48CF95LP63TP95XR75FM84JN36DV67J',
      reason: 'TaskConflict',
    })).toBe('A48CF95LP63TP95XR75FM84JN36DV67J');
  });

  it('is null for a 409 with a different reason — only TaskConflict is safe to auto-resolve', () => {
    expect(conflictingAgentId(409, { agent_id: 'abc', reason: 'SomethingElse' })).toBeNull();
  });

  it('is null for a 409 with no agent_id in the body — nothing to stop', () => {
    expect(conflictingAgentId(409, { reason: 'TaskConflict' })).toBeNull();
  });

  it('is null for any non-409 status, even with a TaskConflict-shaped body', () => {
    expect(conflictingAgentId(404, { agent_id: 'abc', reason: 'TaskConflict' })).toBeNull();
    expect(conflictingAgentId(200, { agent_id: 'abc', reason: 'TaskConflict' })).toBeNull();
    expect(conflictingAgentId(500, { agent_id: 'abc', reason: 'TaskConflict' })).toBeNull();
  });

  it('is null for an empty body', () => {
    expect(conflictingAgentId(409, {})).toBeNull();
  });
});
