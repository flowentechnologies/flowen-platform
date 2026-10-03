import { describe, it, expect } from 'vitest';
import { buildConvoAIJoinPayload } from './convoai-payload';

function baseOpts() {
  return {
    userId: 'user-12345678-abcd',
    channel: 'flowen-abc123',
    token: 'rtc-token',
    agentUid: 9999,
    systemPrompt: 'You are a helpful assistant.',
    llm: { apiKey: 'gem-test-key' },
    voice: { vendor: 'google' as const, credentials: '{"type":"service_account"}' },
  };
}

describe('buildConvoAIJoinPayload', () => {
  it('puts the system prompt under system_messages, not messages — the actual bug: Agora\'s join schema has no `messages` field on llm, so the prompt was silently dropped before this fix', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.llm.system_messages).toEqual([
      { role: 'user', parts: [{ text: 'You are a helpful assistant.' }] },
    ]);
    expect(payload.properties.llm).not.toHaveProperty('messages');
  });

  it('puts the model under llm.params.model, not llm.model — llm.model is not a real field in Agora\'s schema and was silently ignored', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.llm.params.model).toBe('gemini-2.5-flash');
    expect(payload.properties.llm).not.toHaveProperty('model');
  });

  it('puts max_history under llm, not at the top of properties — properties.max_history is not a real field and had no effect', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.llm.max_history).toBe(32);
    expect(payload.properties).not.toHaveProperty('max_history');
  });

  it('enables RTM on both required flags together — Agora requires advanced_features.enable_rtm AND parameters.data_channel="rtm" together for agent-state/error events to fire at all', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.advanced_features.enable_rtm).toBe(true);
    expect(payload.properties.parameters.data_channel).toBe('rtm');
  });

  it('sets a greeting message', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.llm.greeting_message).toBeTruthy();
  });

  it('uses the ElevenLabs voice clone when configured', () => {
    const payload = buildConvoAIJoinPayload({
      ...baseOpts(),
      voice: { vendor: 'elevenlabs', apiKey: 'el-key', voiceId: 'voice-123' },
    });
    expect(payload.properties.tts).toEqual({
      vendor: 'elevenlabs',
      params: {
        api_key: 'el-key',
        voice_id: 'voice-123',
        model_id: 'eleven_turbo_v2_5',
        stability: 0.45,
        similarity_boost: 0.80,
        use_speaker_boost: true,
      },
    });
  });

  it('uses Google Chirp 3 HD TTS when there is no voice clone', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.tts).toEqual({
      vendor: 'google',
      params: {
        credentials: '{"type":"service_account"}',
        VoiceSelectionParams: { name: 'en-US-Chirp3-HD-Charon' },
        AudioConfig: { speaking_rate: 1.0, sample_rate_hertz: 24000 },
      },
    });
  });

  it('uses Google Gemini through Agora: gemini style, key in the streamGenerateContent URL, no OpenAI endpoint', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.llm.style).toBe('gemini');
    expect(payload.properties.llm.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=gem-test-key',
    );
    expect(JSON.stringify(payload)).not.toContain('api.openai.com');
    expect(payload.properties.llm).not.toHaveProperty('api_key');
  });

  it('honours a model override and a custom Chirp voice', () => {
    const payload = buildConvoAIJoinPayload({
      ...baseOpts(),
      llm: { apiKey: 'k', model: 'gemini-3.6-flash' },
      voice: { vendor: 'google', credentials: '{}', voiceName: 'en-GB-Chirp3-HD-Aoede' },
    });
    expect(payload.properties.llm.params.model).toBe('gemini-3.6-flash');
    expect(payload.properties.llm.url).toContain('/models/gemini-3.6-flash:');
    expect((payload.properties.tts as { params: { VoiceSelectionParams: { name: string } } }).params.VoiceSelectionParams.name).toBe('en-GB-Chirp3-HD-Aoede');
  });

  it('remote_rtc_uids wildcard is an array, not a bare string — Agora requires the array form', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(payload.properties.remote_rtc_uids).toEqual(['*']);
  });

  it('agent_rtc_uid is a string, not a number — Agora\'s API type-errors on a bare int', () => {
    const payload = buildConvoAIJoinPayload(baseOpts());
    expect(typeof payload.properties.agent_rtc_uid).toBe('string');
    expect(payload.properties.agent_rtc_uid).toBe('9999');
  });
});
