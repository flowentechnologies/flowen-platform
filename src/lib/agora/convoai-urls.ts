/**
 * Builds Agora ConvoAI REST API URLs.
 *
 * Real, live-production bug fixed here: the route had been calling
 *   {base}/v1/projects/{appId}/join
 *   {base}/v1/projects/{appId}/leave/{agentId}
 * against a base of https://api.agora.io/api/conversational-ai.
 *
 * Checked against Agora's current, authoritative OpenAPI spec
 * (docs-md.agora.io/api/conversational-ai-api-v2.x.yaml) rather than
 * training-data memory: the real base is
 * https://api.agora.io/api/conversational-ai-agent, the real join path is
 * /v2/projects/{appId}/join, and the real leave path is
 * /v2/projects/{appId}/agents/{agentId}/leave — an extra /agents/ segment
 * that was missing entirely, on top of the wrong base path and version.
 *
 * The old path doesn't exist, so every join call this route has ever made
 * has 404'd with Agora's generic "no Route matched with those values" —
 * confirmed in production runtime logs going back to 2026-09-02. No agent
 * has ever actually joined a channel; the practice page's "AI conversation
 * not available" fallback message has been firing on every attempt.
 */

export const DEFAULT_CONVOAI_BASE_URL = 'https://api.agora.io/api/conversational-ai-agent';

export function buildConvoAIJoinUrl(baseUrl: string, appId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/v2/projects/${appId}/join`;
}

export function buildConvoAILeaveUrl(baseUrl: string, appId: string, agentId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/v2/projects/${appId}/agents/${agentId}/leave`;
}

/**
 * Lists every agent instance for this App ID, regardless of channel — used
 * both for a lightweight ConvoAI reachability check (system-health) and to
 * find stale RUNNING agents nobody ever cleanly stopped (agora-agent-sweep).
 * Confirmed against the same OpenAPI spec as the join/leave paths above:
 * GET /v2/projects/{appId}/agents.
 */
export function buildConvoAIListAgentsUrl(baseUrl: string, appId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/v2/projects/${appId}/agents`;
}
