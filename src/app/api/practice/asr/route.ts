/**
 * POST /api/practice/asr
 *
 * Accepts a chunk of base64-encoded WAV audio (assembled by WavEncoder on
 * the mobile client) and returns an OpenAI Whisper transcript.
 *
 * Auth: supports both cookie session (web) and Authorization: Bearer <token>
 * (mobile) via getUserFromRequest.
 *
 * Body: { audio: string (base64 WAV), durationSeconds: number }
 * Response: { text: string }
 *
 * Security:
 *   - Max audio payload: 24 MB base64 (~18 MB binary, well within Whisper's 25 MB limit)
 *   - Min duration: 0.5 s  (avoid billing for empty frames)
 *   - Max duration: 30 s   (flush window on client is 15 s; 30 s gives headroom)
 *   - Rate limit: same Upstash limit applied per user (15 req/session via coach limiter)
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/from-request';
import { decodeWav, getAsrConfig } from '@/lib/asr/config';
import { allowAsr } from '@/lib/asr/rate-limit';

const MAX_B64_BYTES  = 24 * 1024 * 1024; // 24 MB base64
const MIN_DURATION_S = 0.5;
const MAX_DURATION_S = 30;

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: 'ASR not configured' }, { status: 503 });

  let body: { audio?: string; durationSeconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid JSON object' }, { status: 400 });
  const { audio, durationSeconds } = body;

  if (
    typeof audio !== 'string' ||
    audio.length === 0 ||
    audio.length > MAX_B64_BYTES
  ) {
    return NextResponse.json({ error: 'audio must be a non-empty base64 string ≤ 24 MB' }, { status: 400 });
  }

  if (
    typeof durationSeconds !== 'number' ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < MIN_DURATION_S ||
    durationSeconds > MAX_DURATION_S
  ) {
    return NextResponse.json({ error: `durationSeconds must be between ${MIN_DURATION_S} and ${MAX_DURATION_S}` }, { status: 400 });
  }

  if (!await allowAsr(user.id)) return NextResponse.json({ error: 'ASR rate limit reached' }, { status: 429 });
  const config = getAsrConfig();
  // Decode base64 WAV → binary Buffer
  const wavBuffer = decodeWav(audio);
  if (!wavBuffer) return NextResponse.json({ error: 'Audio must be a valid mono PCM16 WAV' }, { status: 400 });

  // Build multipart/form-data for OpenAI Whisper
  // Node 18+ FormData / File are available in Next.js server context
  const wavBlob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('file',  new File([wavBlob], 'audio.wav', { type: 'audio/wav' }));
  formData.append('model', config.model);
  formData.append('language', config.language);
  if (config.prompt) formData.append('prompt', config.prompt);

  let transcript: string;
  try {
    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method:  'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body:    formData,
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!whisperRes.ok) {
      console.error('[ASR] Provider status:', whisperRes.status);
      return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
    }

    const json = await whisperRes.json() as { text?: string };
    transcript = (json.text ?? '').trim();
  } catch (e) {
    console.error('[ASR] fetch error:', e);
    return NextResponse.json({ error: 'Network error reaching ASR service' }, { status: 502 });
  }

  return NextResponse.json({ text: transcript });
}
