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
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getConvoAIHeaders() {
  const customerId = process.env.AGORA_CUSTOMER_ID;
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
  if (!customerId || !customerSecret) throw new Error('Agora ConvoAI credentials not configured');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`,
  };
}

async function getUser(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Start agent ───────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as {
      channel: string;
      token: string;
      agentUid?: number;
      systemPrompt?: string;
      /** ElevenLabs voice_id from the user's voice clone calibration. When present,
       *  TTS switches from OpenAI nova to ElevenLabs IVC so the avatar sounds like the user. */
      voiceCloneId?: string;
    };

    const appId = process.env.AGORA_APP_ID;
    // Agora ConvoAI REST API endpoint.
    // Override AGORA_CONVOAI_BASE_URL if using a non-US region, e.g.:
    //   EU: https://api-eu.agora.io/api/conversational-ai
    //   AP: https://api-ap.agora.io/api/conversational-ai
    const baseUrl = (process.env.AGORA_CONVOAI_BASE_URL ?? 'https://api.agora.io/api/conversational-ai')
      // Strip trailing slash so URL construction is consistent
      .replace(/\/$/, '');
    if (!appId) return NextResponse.json({ error: 'Agora not configured' }, { status: 503 });

    const agentUid = body.agentUid ?? 9999;

    const payload = {
      name: `flowen-agent-${user.id.slice(0, 8)}`,
      properties: {
        channel:        body.channel,
        token:          body.token,
        agent_rtc_uid:  String(agentUid),
        remote_rtc_uids: ['*'], // respond to any user in channel
        idle_timeout:   120,
        max_history:    32,
        asr: {
          language: 'en-US',
        },
        llm: {
          url:   process.env.AGORA_LLM_URL ?? 'https://api.openai.com/v1/chat/completions',
          api_key: process.env.OPENAI_API_KEY ?? '',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: body.systemPrompt ?? [
                'You are Flowen, a warm and encouraging AI speech therapy assistant.',
                'You help people who stutter practise fluency techniques including easy onset,',
                'light articulatory contacts, prolongation, and paced speech.',
                'Keep responses concise (2–3 sentences), supportive, and clinically appropriate.',
                'Celebrate progress and gently redirect when the user struggles.',
              ].join(' '),
            },
          ],
        },
        tts: body.voiceCloneId
          // ── User has a cloned voice — speak back in their own voice ──────────
          ? {
              vendor: 'elevenlabs',
              params: {
                api_key:  process.env.ELEVENLABS_API_KEY ?? '',
                voice_id: body.voiceCloneId,
                model_id: 'eleven_turbo_v2_5', // lowest latency, real-time suitable
                stability:         0.45,
                similarity_boost:  0.80,
                use_speaker_boost: true,
              },
            }
          // ── No clone yet — fall back to OpenAI nova ───────────────────────
          : {
              vendor: 'openai',
              params: {
                api_key: process.env.OPENAI_API_KEY ?? '',
                model:   'tts-1',
                voice:   'nova',
                speed:   1.0,
              },
            },
      },
    };

    const joinUrl = `${baseUrl}/v1/projects/${appId}/join`;
    const res = await fetch(joinUrl, {
      method: 'POST',
      headers: getConvoAIHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json() as { agent_id?: string; error?: string; message?: string };
    if (!res.ok) {
      // "no Route matched with those values" → ConvoAI add-on not enabled for
      // this App ID, or wrong regional endpoint. Log the URL (no credentials)
      // so it's visible in Vercel runtime logs without exposing secrets.
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
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as { agentId: string };
    const appId = process.env.AGORA_APP_ID;
    const baseUrl = process.env.AGORA_CONVOAI_BASE_URL ?? 'https://api.agora.io/api/conversational-ai';

    const res = await fetch(
      `${baseUrl}/v1/projects/${appId}/leave/${body.agentId}`,
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
