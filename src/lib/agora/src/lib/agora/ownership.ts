import { buildConvoAIListAgentsUrl } from './convoai-urls';

export const AGENT_UID = 9999;
export function ownerChannel(userId: string): string {
  return `flowen-${userId.replace(/-/g, '')}`;
}
export function ownerAgentName(userId: string): string {
  return `flowen-agent-${userId}`;
}
export function validAgentId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Provider-side channel membership is the durable ownership binding. Never
 * infer it from a client field, a conflict response or a process-local cache.
 * Missing/malformed/incomplete provider results fail closed. */
export async function agentBelongsToOwner(
  baseUrl: string, appId: string, userId: string, agentId: string,
  headers: HeadersInit,
): Promise<boolean> {
  if (!validAgentId(agentId)) return false;
  let cursor: string | undefined;
  const cursors = new Set<string>();
  for (let page = 0; page < 10; page++) {
    const url = new URL(buildConvoAIListAgentsUrl(baseUrl, appId));
    url.searchParams.set('channel', ownerChannel(userId));
    url.searchParams.set('state', '0,1,2,3');
    url.searchParams.set('from_time', '0');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('Agent ownership verification unavailable');
    const body = await res.json();
    if (!body || !body.data || !Array.isArray(body.data.list) || !body.meta || typeof body.meta.cursor !== 'string') {
      throw new Error('Invalid agent ownership response');
    }
    if (body.data.list.some((a: { agent_id?: unknown }) => a && a.agent_id === agentId)) return true;
    cursor = body.meta.cursor;
    if (!cursor) return false;
    if (cursors.has(cursor)) throw new Error('Incomplete agent ownership response');
    cursors.add(cursor);
  }
  throw new Error('Agent ownership verification exceeded page limit');
}
