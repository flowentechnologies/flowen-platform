/**
 * Finds ConvoAI agents that look abandoned — still reported RUNNING (or
 * stuck STARTING) by Agora's platform long after any real practice
 * conversation would have ended, with nobody left to trigger the
 * force-stop-and-retry path in convoai-conflict.ts (that only fires on the
 * *next* join attempt for that same user; if nobody ever retries, the
 * agent — and the channel it's pinned to — stays occupied indefinitely).
 *
 * start_ts is the agent's creation time as Unix seconds (confirmed against
 * Agora's OpenAPI spec for GET /v2/projects/{appId}/agents), not
 * milliseconds — hence dividing Date.now() by 1000 at the call site.
 */

export type ConvoAIAgentStatus = 'IDLE' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'FAILED';

export interface ConvoAIAgentSummary {
  agent_id: string;
  status:   ConvoAIAgentStatus;
  start_ts: number; // Unix seconds
}

// A real Flowen practice session is a few minutes of conversation, never
// anywhere close to this — chosen generously so a slow-but-legitimate
// session is never mistaken for a zombie, while a genuinely abandoned one
// (tab closed, crash, network drop with no clean stopAgent() call) still
// gets swept well within the same day.
export const STALE_AFTER_SECONDS = 30 * 60;

export function findStaleAgents(
  agents: ConvoAIAgentSummary[],
  nowUnixSeconds: number,
  staleAfterSeconds: number = STALE_AFTER_SECONDS,
): ConvoAIAgentSummary[] {
  return agents.filter(
    (a) =>
      (a.status === 'RUNNING' || a.status === 'STARTING') &&
      nowUnixSeconds - a.start_ts > staleAfterSeconds,
  );
}
