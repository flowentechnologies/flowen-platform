/**
 * POST /api/practice/asr
 *
 * Accepts a chunk of base64-encoded WAV audio (assembled by WavEncoder on
 * the mobile client) and returns a self-hosted Whisper transcript.
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
 *   - Rate limit: separate Upstash ASR budget (360 requests per user/hour); fails closed in Production if missing
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/from-request';
import { decodeWav, getAsrConfig } from '@/lib/asr/config';
import { transcribe } from '@/lib/asr/provider';
import { allowAsr } from '@/lib/asr/rate-limit';

const MAX_B64_BYTES  = 24 * 1024 * 1024; // 24 MB base64
const MIN_DURATION_S = 0.5;
const MAX_DURATION_S = 30;

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = getAsrConfig();
  if (!config.configured) return NextResponse.json({ error: 'ASR not configured' }, { status: 503 });

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
  // Decode base64 WAV → binary Buffer
  const wavBuffer = decodeWav(audio);
  if (!wavBuffer) return NextResponse.json({ error: 'Audio must be a valid mono PCM16 WAV' }, { status: 400 });

  let transcript: string;
  try {
    transcript = await transcribe(wavBuffer, config);
  } catch {
    // No exception bodies, URLs, credentials, audio or transcripts in logs.
    console.error('[ASR] self-hosted provider failed');
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 });
  }

  return NextResponse.json({ text: transcript });
}
