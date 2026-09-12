import { describe, it, expect } from 'vitest';
import { findStaleAgents, STALE_AFTER_SECONDS, type ConvoAIAgentSummary } from './convoai-sweep';

const NOW = 1_800_000_000; // arbitrary fixed "now", in Unix seconds

function agent(overrides: Partial<ConvoAIAgentSummary> = {}): ConvoAIAgentSummary {
  return { agent_id: 'agent-1', status: 'RUNNING', start_ts: NOW - 60, ...overrides };
}

describe('findStaleAgents', () => {
  it('leaves a fresh RUNNING agent alone — a real practice session in progress', () => {
    expect(findStaleAgents([agent({ start_ts: NOW - 60 })], NOW)).toEqual([]);
  });

  it('flags a RUNNING agent well past the stale threshold — the exact zombie case: tab closed, stopAgent() never called', () => {
    const stale = agent({ agent_id: 'zombie-1', start_ts: NOW - STALE_AFTER_SECONDS - 1 });
    expect(findStaleAgents([stale], NOW)).toEqual([stale]);
  });

  it('also flags a stuck STARTING agent, not just RUNNING — an init that never completed is just as abandoned', () => {
    const stuck = agent({ agent_id: 'stuck-1', status: 'STARTING', start_ts: NOW - STALE_AFTER_SECONDS - 1 });
    expect(findStaleAgents([stuck], NOW)).toEqual([stuck]);
  });

  it('ignores STOPPED, STOPPING, IDLE, and FAILED regardless of age — nothing left to force-stop', () => {
    const old = NOW - STALE_AFTER_SECONDS - 1000;
    const agents = (['STOPPED', 'STOPPING', 'IDLE', 'FAILED'] as const).map((status) =>
      agent({ status, start_ts: old }),
    );
    expect(findStaleAgents(agents, NOW)).toEqual([]);
  });

  it('sits exactly on the threshold without tripping it — only strictly older counts as stale', () => {
    expect(findStaleAgents([agent({ start_ts: NOW - STALE_AFTER_SECONDS })], NOW)).toEqual([]);
  });

  it('handles a mixed batch — some stale, some not', () => {
    const fresh = agent({ agent_id: 'fresh', start_ts: NOW - 30 });
    const stale = agent({ agent_id: 'stale', start_ts: NOW - STALE_AFTER_SECONDS - 30 });
    expect(findStaleAgents([fresh, stale], NOW)).toEqual([stale]);
  });

  it('returns empty for an empty agent list', () => {
    expect(findStaleAgents([], NOW)).toEqual([]);
  });
});
