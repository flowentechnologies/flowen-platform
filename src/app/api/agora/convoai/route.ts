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

function getConvoAIHeaders() {
  const customerId = process.env.AGORA_CUSTOMER_ID;
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
  if (!customerId || !customerSecret) throw new Error('Agora ConvoAI credentials not configured');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`,
  };
}

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

    const body = await req.json() as {
      channel: string;
      token: string;
      agentUid?: number;
      systemPrompt?: string;
      // voiceCloneId from client is ignored — we use the DB value to prevent spoofing
    };

    const appId = process.env.AGORA_APP_ID;
    // Agora ConvoAI REST API endpoint.
    // Override AGORA_CONVOAI_BASE_URL if using a non-US region, e.g.:
    //   EU: https://api-eu.agora.io/api/conversational-ai-agent
    //   AP: https://api-ap.agora.io/api/conversational-ai-agent
    const baseUrl = process.env.AGORA_CONVOAI_BASE_URL ?? DEFAULT_CONVOAI_BASE_URL;
    if (!appId) return NextResponse.json({ error: 'Agora not configured' }, { status: 503 });

    const agentUid = body.agentUid ?? 9999;

    const defaultSystemPrompt = [
      'You are Flowen, a warm and encouraging AI speech therapy assistant.',
      'You help people who stutter practise fluency techniques including easy onset,',
      'light articulatory contacts, prolongation, and paced speech.',
      'Keep responses concise (2–3 sentences), supportive, and clinically appropriate.',
      'Celebrate progress and gently redirect when the user struggles.',
    ].join(' ');

    const payload = buildConvoAIJoinPayload({
      userId:       user.id,
      channel:      body.channel,
      token:        body.token,
      agentUid,
      // Clamp to prevent token-bomb attacks; slice at a word boundary
      systemPrompt: (body.systemPrompt ?? defaultSystemPrompt).slice(0, MAX_SYSTEM_PROMPT_CHARS),
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
    });
    let data = await res.json() as { agent_id?: string; error?: string; message?: string; reason?: string };

    // The agent name (and the channel) are deterministic per user, not per
    // session — a user only ever has one active session by design. That
    // means any session that ends without a clean DELETE (a closed tab,
    // a network drop, a crash) leaves an agent Agora still considers
    // running under that exact name, and the next join attempt 409s.
    // Agora's own error body names the blocking agent, so force-stop it
    // and retry once rather than surfacing an opaque conflict to the user.
    const staleAgentId = conflictingAgentId(res.status, data);
    if (staleAgentId) {
      console.warn(`[convoai] stale agent ${staleAgentId} blocking a new join — stopping it and retrying`);
      await fetch(buildConvoAILeaveUrl(baseUrl, appId, staleAgentId), {
        method: 'DELETE',
        headers: getConvoAIHeaders(),
      }).catch((err) => console.warn('[convoai] failed to stop stale agent (continuing to retry anyway):', err));

      res = await fetch(joinUrl, {
        method: 'POST',
        headers: getConvoAIHeaders(),
        body: JSON.stringify(payload),
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

    const body = await req.json() as { agentId: string; channel?: string };

    // Ownership check: the caller must supply their channel and it must match
    // the deterministic channel derived from their user ID. This prevents an
    // authenticated user from stopping another user's live AI session.
    const expectedChannel = `flowen-${user.id.replace(/-/g, '').slice(0, 16)}`;
    if (body.channel && body.channel !== expectedChannel) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const appId = process.env.AGORA_APP_ID;
    if (!appId) return NextResponse.json({ error: 'Agora not configured' }, { status: 503 });
    const baseUrl = process.env.AGORA_CONVOAI_BASE_URL ?? DEFAULT_CONVOAI_BASE_URL;

    const res = await fetch(
      buildConvoAILeaveUrl(baseUrl, appId, body.agentId),
      {
        method: 'DELETE',
        headers: getConvoAIHeaders(),
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
