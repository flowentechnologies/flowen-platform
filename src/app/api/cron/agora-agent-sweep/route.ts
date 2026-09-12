/**
 * agora-agent-sweep
 *
 * Force-stops ConvoAI agents Agora still reports RUNNING/STARTING long
 * after any real practice conversation would have ended.
 *
 * Both the agent name and RTC channel are deterministic per user (see
 * convoai-conflict.ts) — a session that ends uncleanly (tab closed, crash,
 * network drop, no stopAgent() call) leaves that user's agent "running"
 * under Agora's platform state forever. The existing fix in
 * /api/agora/convoai only force-stops a stale agent reactively, on that
 * same user's *next* join attempt — if nobody retries, nothing ever cleans
 * it up. This sweep is the proactive half: list every agent for the App
 * ID, and stop any one that's been RUNNING/STARTING well past a real
 * session's length (see STALE_AFTER_SECONDS in convoai-sweep.ts).
 *
 * Safe to run aggressively: worst case it stops a session that was
 * genuinely still in progress well past 30 minutes, which the user can
 * just restart — the same recoverable path a stale-agent 409 already
 * takes, not data loss.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logging';
import { getConvoAIHeaders } from '@/lib/agora/convoai-auth';
import { DEFAULT_CONVOAI_BASE_URL, buildConvoAIListAgentsUrl, buildConvoAILeaveUrl } from '@/lib/agora/convoai-urls';
import { findStaleAgents, type ConvoAIAgentSummary } from '@/lib/agora/convoai-sweep';

interface ListAgentsResponse {
  data?: { list?: ConvoAIAgentSummary[]; count?: number; cursor?: string };
}

// Defensive cap on pagination — this app has never had more than a handful
// of concurrent practice sessions; this just bounds worst-case work if that
// ever changes rather than looping forever on a misbehaving cursor.
const MAX_PAGES = 10;

async function listAllAgents(baseUrl: string, appId: string): Promise<ConvoAIAgentSummary[]> {
  const agents: ConvoAIAgentSummary[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(buildConvoAIListAgentsUrl(baseUrl, appId));
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), { headers: getConvoAIHeaders() });
    if (!res.ok) throw new Error(`ConvoAI list agents -> ${res.status}: ${await res.text()}`);

    const body = await res.json() as ListAgentsResponse;
    agents.push(...(body.data?.list ?? []));

    cursor = body.data?.cursor;
    if (!cursor) break;
  }

  return agents;
}

async function handle(_req: NextRequest): Promise<NextResponse> {
  const appId = process.env.AGORA_APP_ID;
  const configured = Boolean(appId && process.env.AGORA_CUSTOMER_ID && process.env.AGORA_CUSTOMER_SECRET);
  if (!configured) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Agora ConvoAI not configured' });
  }

  const baseUrl = process.env.AGORA_CONVOAI_BASE_URL ?? DEFAULT_CONVOAI_BASE_URL;

  const agents = await listAllAgents(baseUrl, appId!);
  const stale = findStaleAgents(agents, Math.floor(Date.now() / 1000));

  const stopped: string[] = [];
  const failed: { agentId: string; error: string }[] = [];

  for (const agent of stale) {
    try {
      const res = await fetch(buildConvoAILeaveUrl(baseUrl, appId!, agent.agent_id), {
        method:  'DELETE',
        headers: getConvoAIHeaders(),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      stopped.push(agent.agent_id);
    } catch (err) {
      failed.push({ agentId: agent.agent_id, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({
    ok:      failed.length === 0,
    checked: agents.length,
    stale:   stale.map((a) => ({ agentId: a.agent_id, status: a.status, ageSeconds: Math.floor(Date.now() / 1000) - a.start_ts })),
    stopped,
    failed,
  });
}

export const GET  = withCronLogging('agora-agent-sweep', handle);
export const POST = withCronLogging('agora-agent-sweep', handle);
