/**
 * Builds the request body for Agora ConvoAI's POST /join endpoint.
 *
 * Extracted specifically to pin down three real bugs found by checking the
 * inline version (previously hand-built in the route) against Agora's actual
 * join schema (docs-md.agora.io/api/conversational-ai-api-v2.x.yaml), not
 * against training-data memory of it:
 *
 *   - `model` was set directly on `llm` — not a real field there. The model
 *     selection belongs in `llm.params.model`. Since `llm.url` points at the
 *     real api.openai.com endpoint (which requires `model` on every
 *     request), this very likely meant the LLM call was malformed the whole
 *     time this route has been live.
 *   - `messages` was set on `llm` — the real field name is `system_messages`.
 *     The carefully-written system prompt was very likely never reaching
 *     the model.
 *   - `max_history` sat at the top of `properties` — not a field there at
 *     all; it only exists on `llm`. Silently had no effect.
 *
 * Also adds `advanced_features.enable_rtm` + `parameters.data_channel:
 * 'rtm'` — Agora's own docs are explicit both are required together for
 * agent-state/error events to fire — and a `greeting_message`, neither of
 * which existed before.
 */

export interface ConvoAIVoiceConfig {
  vendor: 'elevenlabs' | 'openai';
  apiKey: string;
  // elevenlabs-only
  voiceId?: string;
  // openai-only
  model?: string;
  voice?: string;
}

export interface BuildConvoAIJoinPayloadOptions {
  userId: string;
  channel: string;
  token: string;
  agentUid: number;
  systemPrompt: string;
  llmUrl: string;
  llmApiKey: string;
  voice: ConvoAIVoiceConfig;
}

export function buildConvoAIJoinPayload(opts: BuildConvoAIJoinPayloadOptions) {
  return {
    name: `flowen-agent-${opts.userId.slice(0, 8)}`,
    properties: {
      channel:         opts.channel,
      token:           opts.token,
      agent_rtc_uid:   String(opts.agentUid),
      remote_rtc_uids: ['*'], // respond to any user in channel
      idle_timeout:    120,
      advanced_features: {
        enable_rtm: true,
      },
      asr: {
        language: 'en-US',
      },
      llm: {
        url:     opts.llmUrl,
        api_key: opts.llmApiKey,
        max_history: 32,
        greeting_message: "Hi, I'm here whenever you're ready — just start talking and we'll practise together.",
        failure_message: "Sorry, I had trouble with that — let's try again.",
        system_messages: [
          { role: 'system', content: opts.systemPrompt },
        ],
        params: {
          model: 'gpt-4o-mini',
        },
      },
      tts: opts.voice.vendor === 'elevenlabs'
        ? {
            vendor: 'elevenlabs',
            params: {
              api_key:  opts.voice.apiKey,
              voice_id: opts.voice.voiceId,
              model_id: 'eleven_turbo_v2_5', // lowest latency, real-time suitable
              stability:         0.45,
              similarity_boost:  0.80,
              use_speaker_boost: true,
            },
          }
        : {
            vendor: 'openai',
            params: {
              api_key: opts.voice.apiKey,
              model:   opts.voice.model ?? 'tts-1',
              voice:   opts.voice.voice ?? 'nova',
              speed:   1.0,
            },
          },
      parameters: {
        data_channel:         'rtm',
        enable_metrics:       true,
        enable_error_message: true,
      },
    },
  };
}
