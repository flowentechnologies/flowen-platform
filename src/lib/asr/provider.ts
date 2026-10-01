import { getAsrConfig } from './config';
/** Both targets host our worker. No managed ASR API or automatic fallback. */
export async function transcribe(wav: Buffer, config = getAsrConfig()): Promise<string> {
  if (!config.configured) throw new Error('ASR not configured');
  const response = await fetch(config.endpoint, {
    method: 'POST', redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ASR_ENDPOINT_KEY}` },
    body: JSON.stringify({ audio: wav.toString('base64'), model: config.model, language: config.language, prompt: config.prompt }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok || !response.body) throw new Error('Provider unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) throw new Error('Provider response too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const json: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!json || typeof json !== 'object' || !('text' in json) || typeof json.text !== 'string' || json.text.length > 16000) throw new Error('Invalid transcript');
  return json.text.trim();
}
