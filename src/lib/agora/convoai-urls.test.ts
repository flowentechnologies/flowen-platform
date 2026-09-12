import { describe, it, expect } from 'vitest';
import { buildConvoAIJoinUrl, buildConvoAILeaveUrl, buildConvoAIListAgentsUrl, DEFAULT_CONVOAI_BASE_URL } from './convoai-urls';

describe('buildConvoAIJoinUrl', () => {
  it('builds the v2 join path — the route used to build /v1/projects/{appId}/join, which 404s: Agora moved this to /v2', () => {
    expect(buildConvoAIJoinUrl('https://api.agora.io/api/conversational-ai-agent', 'app123'))
      .toBe('https://api.agora.io/api/conversational-ai-agent/v2/projects/app123/join');
  });

  it('strips a trailing slash on the base URL so double slashes never appear', () => {
    expect(buildConvoAIJoinUrl('https://api.agora.io/api/conversational-ai-agent/', 'app123'))
      .toBe('https://api.agora.io/api/conversational-ai-agent/v2/projects/app123/join');
  });
});

describe('buildConvoAILeaveUrl', () => {
  it('includes the /agents/ segment before the agent ID — the route used to call /leave/{agentId} directly, missing this segment entirely', () => {
    expect(buildConvoAILeaveUrl('https://api.agora.io/api/conversational-ai-agent', 'app123', 'agent456'))
      .toBe('https://api.agora.io/api/conversational-ai-agent/v2/projects/app123/agents/agent456/leave');
  });

  it('strips a trailing slash on the base URL', () => {
    expect(buildConvoAILeaveUrl('https://api.agora.io/api/conversational-ai-agent/', 'app123', 'agent456'))
      .toBe('https://api.agora.io/api/conversational-ai-agent/v2/projects/app123/agents/agent456/leave');
  });
});

describe('buildConvoAIListAgentsUrl', () => {
  it('builds the /agents list path, no agent ID — used to find every running agent for the App ID', () => {
    expect(buildConvoAIListAgentsUrl('https://api.agora.io/api/conversational-ai-agent', 'app123'))
      .toBe('https://api.agora.io/api/conversational-ai-agent/v2/projects/app123/agents');
  });

  it('strips a trailing slash on the base URL', () => {
    expect(buildConvoAIListAgentsUrl('https://api.agora.io/api/conversational-ai-agent/', 'app123'))
      .toBe('https://api.agora.io/api/conversational-ai-agent/v2/projects/app123/agents');
  });
});

describe('DEFAULT_CONVOAI_BASE_URL', () => {
  it('points at the conversational-ai-agent path, not the old conversational-ai path that 404s', () => {
    expect(DEFAULT_CONVOAI_BASE_URL).toBe('https://api.agora.io/api/conversational-ai-agent');
  });
});
