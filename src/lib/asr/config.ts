/** Deployment configuration for transcription only, never the acoustic loop. */
export function getAsrConfig(env: Record<string, string | undefined> = process.env) {
  const language = env.ASR_LANGUAGE?.trim() || 'en';
  const timeout = Number(env.ASR_TIMEOUT_MS || 20000);
  return {
    model: 'whisper-1' as const,
    language: /^[a-z]{2}$/.test(language) ? language : 'en',
    timeoutMs: Number.isFinite(timeout) ? Math.min(30000, Math.max(1000, timeout)) : 20000,
    // Do not inject coaching phrases into recognised speech.
    prompt: (env.ASR_VOCABULARY_PROMPT || '').trim().slice(0, 1000),
    configured: Boolean(env.OPENAI_API_KEY),
  };
}
export function decodeWav(audio: unknown): Buffer | null {
  if (typeof audio !== 'string' || !audio.length || audio.length > 24 * 1024 * 1024 || audio.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) return null;
  const b = Buffer.from(audio, 'base64');
  if (b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return null;
  // Walk chunks rather than assuming fmt/data positions; reject truncated uploads.
  let pcm = false, data = false;
  for (let offset = 12; offset + 8 <= b.length;) {
    const size = b.readUInt32LE(offset + 4), end = offset + 8 + size;
    if (end > b.length) return null;
    const type = b.toString('ascii', offset, offset + 4);
    if (type === 'fmt ') {
      if (size < 16 || b.readUInt16LE(offset + 8) !== 1 || b.readUInt16LE(offset + 10) !== 1 || b.readUInt16LE(offset + 22) !== 16) return null;
      const rate = b.readUInt32LE(offset + 12);
      if (rate < 8000 || rate > 48000) return null;
      pcm = true;
    }
    if (type === 'data' && size > 0) data = true;
    offset = end + (size % 2);
  }
  return pcm && data ? b : null;
}
