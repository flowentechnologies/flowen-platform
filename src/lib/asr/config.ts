/** Deployment configuration for transcription only, never the acoustic loop. */
export function getAsrConfig(env: Record<string, string | undefined> = process.env) {
  const provider = env.ASR_PROVIDER || 'modal';
  const endpoint = env.ASR_ENDPOINT_URL || '';
  let validEndpoint = false;
  try {
    const u = new URL(endpoint);
    const suffix = provider === 'modal' ? '.modal.run' : '.api.runpod.ai';
    validEndpoint = ['modal', 'runpod'].includes(provider) && u.protocol === 'https:' &&
      u.hostname.endsWith(suffix) && !u.username && !u.password && !u.search && !u.hash &&
      (!u.port || u.port === '443');
  } catch { /* Fail closed, never fall back to a different processor. */ }
  const model = env.ASR_MODEL || 'large-v3-turbo';
  const language = env.ASR_LANGUAGE?.trim() || 'en';
  const timeout = Number(env.ASR_TIMEOUT_MS || 25000);
  const key = env.ASR_ENDPOINT_KEY || '';
  return {
    provider, endpoint, model,
    language: /^[a-z]{2}$/.test(language) ? language : 'en',
    timeoutMs: Number.isFinite(timeout) ? Math.min(30000, Math.max(1000, timeout)) : 25000,
    prompt: (env.ASR_VOCABULARY_PROMPT || '').trim().slice(0, 1000),
    configured: validEndpoint && ['large-v3-turbo', 'distil-large-v3'].includes(model) &&
      (model !== 'distil-large-v3' || language === 'en') && key.length >= 32 && !/[\r\n]/.test(key),
  };
}
export function decodeWav(audio: unknown): Buffer | null {
  if (typeof audio !== 'string' || !audio.length || audio.length > 24 * 1024 * 1024 || audio.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) return null;
  const b = Buffer.from(audio, 'base64');
  if (b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') return null;
  // Walk chunks rather than assuming fmt/data positions; reject truncated uploads.
  let pcm = false, data = false, sampleRate = 0, dataBytes = 0;
  for (let offset = 12; offset + 8 <= b.length;) {
    const size = b.readUInt32LE(offset + 4), end = offset + 8 + size;
    if (end > b.length) return null;
    const type = b.toString('ascii', offset, offset + 4);
    if (type === 'fmt ') {
      if (size < 16 || b.readUInt16LE(offset + 8) !== 1 || b.readUInt16LE(offset + 10) !== 1 || b.readUInt16LE(offset + 22) !== 16) return null;
      const rate = b.readUInt32LE(offset + 12);
      if (rate < 8000 || rate > 48000) return null;
      sampleRate = rate;
      if (b.readUInt16LE(offset + 20) !== 2 || b.readUInt32LE(offset + 16) !== rate * 2) return null;
      pcm = true;
    }
    if (type === 'data' && size > 0) { data = true; dataBytes += size; }
    offset = end + (size % 2);
  }
  const seconds = dataBytes / (sampleRate * 2);
  return pcm && data && seconds >= 0.5 && seconds <= 30 && b.readUInt32LE(4) + 8 === b.length ? b : null;
}
