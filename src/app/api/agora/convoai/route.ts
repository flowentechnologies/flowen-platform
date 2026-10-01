/**
 * /api/agora/convoai
 *
 * Proxy for Agora ConvoAI API. Keeps AGORA_CUSTOMER_ID / AGORA_CUSTOMER_SECRET
 * server-side. Client calls this to start and stop AI agents.
 *
 * POST  { channel, token, agentUid, systemPrompt? }
 *   → Joins the channel with a ConvoAI agent (ASR → LLM → TTS)
 *   → Returns { agentId }
 *
 * DELETE { agentId }
 *   → Stops the agent and releases the channel slot
 */
import { NextResponse } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/lib/supabase/from-request';
import { buildConvoAIJoinPayload } from '@/lib/agora/convoai-payload';
import { DEFAULT_CONVOAI_BASE_URL, buildConvoAIJoinUrl, buildConvoAILeaveUrl } from '@/lib/agora/convoai-urls';
import { conflictingAgentId } from '@/lib/agora/convoai-conflict';
import { getConvoAIHeaders } from '@/lib/agora/convoai-auth';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { AGENT_UID, ownerChannel, agentBelongsToOwner, validAgentId } from '@/lib/agora/ownership';

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getUserAndProfile(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return { user: null, voiceCloneId: null };

  // Fetch server-side voice_clone_id so clients cannot spoof another user's voice
  const { data: profile } = await adminDb()
    .from('profiles')
    .select('voice_clone_id')
    .eq('id', user.id)
    .single();

  return { user, voiceCloneId: (profile?.voice_clone_id as string | null) ?? null };
}

const MAX_SYSTEM_PROMPT_CHARS = 2000;

// ── Start agent ───────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { user, voiceCloneId: storedVoiceCloneId } = await getUserAndProfile(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      body = parsed;
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const channel = ownerChannel(user.id);
    if (body.channel !== undefined && body.channel !== channel) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if ((body.agentUid !== undefined && body.agentUid !== AGENT_UID) ||
        (body.systemPrompt !== undefined && typeof body.systemPrompt !== 'string')) {
      return NextResponse.json({ error: 'Invalid agent configuration' }, { status: 400 });
    }

    const appId = process.env.AGORA_APP_ID;
    // Agora ConvoAI REST API endpoint.
    // Override AGORA_CONVOAI_BASE_URL if using a non-US region, e.g.:
    //   EU: https://api-eu.agora.io/api/conversational-ai-agent
    //   AP: https://api-ap.agora.io/api/conversational-ai-agent
    const baseUrl = process.env.AGORA_CONVOAI_BASE_URL ?? DEFAULT_CONVOAI_BASE_URL;
    const appCert = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCert) return NextResponse.json({ error: 'Agora not configured' }, { status: 503 });

    const agentUid = AGENT_UID;
    // Client RTC tokens belong to the user, not the agent. Mint an agent token
    // scoped to the server-derived channel and fixed bot UID.
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const agentToken = RtcTokenBuilder.buildTokenWithUid(
      appId, appCert, channel, agentUid, RtcRole.PUBLISHER, expiresAt, expiresAt,
    );

    const defaultSystemPrompt = [
      'You are Flowen, a warm and encouraging AI speech therapy assistant.',
      'You help people who stutter practise fluency techniques including easy onset,',
      'light articulatory contacts, prolongation, and paced speech.',
      'Keep responses concise (2–3 sentences), supportive, and clinically appropriate.',
      'Celebrate progress and gently redirect when the user struggles.',
    ].join(' ');

    const payload = buildConvoAIJoinPayload({
      userId:       user.id,
      channel,
      token:        agentToken,
      agentUid,
      // Clamp to prevent token-bomb attacks; slice at a word boundary
      systemPrompt: (typeof body.systemPrompt === 'string' ? body.systemPrompt : defaultSystemPrompt).slice(0, MAX_SYSTEM_PROMPT_CHARS),
      llmUrl:       process.env.AGORA_LLM_URL ?? 'https://api.openai.com/v1/chat/completions',
      llmApiKey:    process.env.OPENAI_API_KEY ?? '',
      voice: storedVoiceCloneId
        ? { vendor: 'elevenlabs', apiKey: process.env.ELEVENLABS_API_KEY ?? '', voiceId: storedVoiceCloneId }
        : { vendor: 'openai', apiKey: process.env.OPENAI_API_KEY ?? '' },
    });

    const joinUrl = buildConvoAIJoinUrl(baseUrl, appId);
    let res = await fetch(joinUrl, {
      method: 'POST',
      headers: getConvoAIHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    let data = await res.json() as { agent_id?: string; error?: string; message?: string; reason?: string };

    // The agent name (and the channel) are deterministic per user, not per
    // session — a user only ever has one active session by design. That
    // means any session that ends without a clean DELETE (a closed tab,
    // a network drop, a crash) leaves an agent Agora still considers
    // running under that exact name, and the next join attempt 409s.
    // Agora's own error body names the blocking agent, so force-stop it
    // and retry rather than surfacing an opaque conflict to the user.
    //
    // Up to 2 retries, each with a short delay before rejoining: a DELETE
    // returning 200 doesn't guarantee Agora has released the agent name by
    // the time an immediate retry lands — an unconditional single retry
    // with no delay left a real, recurring failure mode (practice page
    // stuck on "Connecting…" forever) where the retry itself still 409'd.
    // The delay and the second attempt give that eventual-consistency gap
    // room to close before giving up.
    for (let attempt = 0; attempt < 2; attempt++) {
      const staleAgentId = conflictingAgentId(res.status, data);
      if (!staleAgentId) break;
      // A conflict response is not owner evidence. Do not stop anything until
      // the provider confirms that ID is on this caller's exact channel.
      let owned: boolean;
      try {
        owned = await agentBelongsToOwner(baseUrl, appId, user.id, staleAgentId, getConvoAIHeaders());
      } catch {
        return NextResponse.json({ error: 'Agent ownership verification unavailable' }, { status: 503 });
      }
      if (!owned) return NextResponse.json({ error: 'Agent conflict could not be verified' }, { status: 409 });

      console.warn(`[convoai] stale agent ${staleAgentId} blocking a new join — stopping it and retrying (attempt ${attempt + 1})`);
      await fetch(buildConvoAILeaveUrl(baseUrl, appId, staleAgentId), {
        method: 'DELETE',
        headers: getConvoAIHeaders(),
        signal: AbortSignal.timeout(8000),
      }).then((leave) => { if (!leave.ok) throw new Error('Verified agent stop failed'); });

      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));

      res = await fetch(joinUrl, {
        method: 'POST',
        headers: getConvoAIHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      data = await res.json() as typeof data;
    }

    if (!res.ok) {
      // "no Route matched with those values" → either the URL is wrong (was
      // the actual cause here for a long time — see convoai-urls.ts) or the
      // ConvoAI add-on isn't enabled for this App ID / the regional endpoint
      // is wrong. Log the URL (no credentials) so it's visible in Vercel
      // runtime logs without exposing secrets.
      console.error('[convoai] join error:', data, '| url:', joinUrl, '| status:', res.status);
      const message = data.message ?? data.error ?? 'Agent start failed';
      const isNotFound = res.status === 404 || message.toLowerCase().includes('no route');
      return NextResponse.json(
        {
          error: isNotFound
            ? 'AI conversation not available — please ensure the ConvoAI add-on is enabled in the Agora Console for this App ID.'
            : message,
        },
        { status: res.status },
      );
    }

    if (!validAgentId(data.agent_id)) {
      return NextResponse.json({ error: 'Invalid agent response' }, { status: 502 });
    }
    return NextResponse.json({ agentId: data.agent_id, agentUid });
  } catch (err) {
    console.error('[agora/convoai] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Stop agent ────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      body = parsed;
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    if (!validAgentId(body.agentId)) {
      return NextResponse.json({ error: 'Invalid agent ID' }, { status: 400 });
    }
    if (body.channel !== undefined && body.channel !== ownerChannel(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const appId = process.env.AGORA_APP_ID;
    if (!appId) return NextResponse.json({ error: 'Agora not configured' }, { status: 503 });
    const baseUrl = process.env.AGORA_CONVOAI_BASE_URL ?? DEFAULT_CONVOAI_BASE_URL;

    let owned: boolean;
    try {
      owned = await agentBelongsToOwner(baseUrl, appId, user.id, body.agentId, getConvoAIHeaders());
    } catch {
      return NextResponse.json({ error: 'Agent ownership verification unavailable' }, { status: 503 });
    }
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const res = await fetch(
      buildConvoAILeaveUrl(baseUrl, appId, body.agentId),
      {
        method: 'DELETE',
        headers: getConvoAIHeaders(),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return NextResponse.json({ error: data.error ?? 'Agent stop failed' }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[agora/convoai] DELETE error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
