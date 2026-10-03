import { ownerAgentName } from './ownership';
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
 *
 * LLM is Google Gemini via Agora's `style: 'gemini'` (Agora docs:
 * conversational-ai/models/llm/gemini). The API key travels in the URL query
 * string, as Agora's Gemini integration requires, and system messages use the
 * `parts` shape instead of `content`.
 *
 * Default TTS is Google Chirp 3 HD (Agora vendor `google`, which takes a
 * service-account credentials JSON string). ElevenLabs stays for users with a
 * cloned voice.
 */

export type ConvoAIVoiceConfig =
  | { vendor: 'elevenlabs'; apiKey: string; voiceId: string }
  | {
      vendor: 'google';
      /** Google Cloud service-account credentials, as a JSON string. */
      credentials: string;
      /** e.g. en-US-Chirp3-HD-Charon. Defaults to DEFAULT_GOOGLE_VOICE. */
      voiceName?: string;
    };

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_GOOGLE_VOICE = 'en-US-Chirp3-HD-Charon';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function buildGeminiLlmUrl(model: string, apiKey: string): string {
  return `${GEMINI_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
}

export interface BuildConvoAIJoinPayloadOptions {
  userId: string;
  channel: string;
  token: string;
  agentUid: number;
  systemPrompt: string;
  llm: { apiKey: string; model?: string };
  voice: ConvoAIVoiceConfig;
}

export function buildConvoAIJoinPayload(opts: BuildConvoAIJoinPayloadOptions) {
  const model = opts.llm.model ?? DEFAULT_GEMINI_MODEL;
  return {
    name: ownerAgentName(opts.userId),
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
        url:     buildGeminiLlmUrl(model, opts.llm.apiKey),
        style:   'gemini',
        ignore_empty: true,
        max_history: 32,
        greeting_message: "Hi, I'm here whenever you're ready — just start talking and we'll practise together.",
        failure_message: "Sorry, I had trouble with that — let's try again.",
        system_messages: [
          { role: 'user', parts: [{ text: opts.systemPrompt }] },
        ],
        params: {
          model,
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
            vendor: 'google',
            params: {
              credentials: opts.voice.credentials,
              VoiceSelectionParams: { name: opts.voice.voiceName ?? DEFAULT_GOOGLE_VOICE },
              AudioConfig: { speaking_rate: 1.0, sample_rate_hertz: 24000 },
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
