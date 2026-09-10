/**
 * Detects Agora's "a session with this name already exists" conflict on
 * ConvoAI /join, so the route can force-stop the stale agent and retry
 * once instead of surfacing an opaque 409 to the user.
 *
 * Both the ConvoAI agent name (`flowen-agent-${userId.slice(0,8)}`, see
 * convoai-payload.ts) and the RTC channel are deterministic per user, not
 * per session — intentional, so a user only ever has one active session.
 * The failure mode this causes: any session that ends without a clean
 * stopAgent() call (tab closed mid-session, network drop, a crash) leaves
 * an agent Agora still considers "running" under that exact name. The next
 * attempt reuses the identical name and 409s with TaskConflict — the
 * practice page then hangs on "Connecting…" forever, because the RTC side
 * joined fine and there's nothing else to time it out.
 *
 * Agora's 409 body already names the blocking agent
 * ({ agent_id, reason: 'TaskConflict' }), so the fix doesn't need any
 * server-side session tracking of our own — just stop that agent_id and
 * retry the join.
 */

export interface ConvoAIErrorBody {
  agent_id?: string;
  reason?:   string;
}

/** Returns the blocking agent's ID if this is a recoverable name conflict, else null. */
export function conflictingAgentId(status: number, body: ConvoAIErrorBody): string | null {
  if (status !== 409) return null;
  if (body.reason !== 'TaskConflict') return null;
  return body.agent_id ?? null;
}
