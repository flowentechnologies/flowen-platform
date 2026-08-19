/**
 * GET /api/admin/seedance-smoke?token=flowen-seedance-smoke-2026
 *
 * Submits a minimal Seedance generation task and polls up to 90 s.
 * Confirms the model is activated and the full submit→poll→video_url
 * pipeline works end to end.
 *
 * Temporary endpoint — remove after successful test.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createVideoTask, getVideoTask } from '@/lib/byteplus/seedance';

const SMOKE_TOKEN   = 'flowen-seedance-smoke-2026';
const POLL_INTERVAL = 6_000;   // ms between polls
const MAX_POLLS     = 15;      // 15 × 6 s = 90 s max wait

export const maxDuration = 120; // Vercel function timeout

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('token') !== SMOKE_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const startMs = Date.now();

  // 1. Submit the smallest possible generation task
  let jobId: string;
  try {
    jobId = await createVideoTask({
      prompt:     'A single white circle pulsing slowly on a black background.',
      model:      'dreamina-seedance-2-0-fast-260128', // cheapest / fastest model
      ratio:      '1:1',
      resolution: '480p',
      duration:   4,          // minimum duration
      generate_audio: false,
      watermark:  false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { phase: 'submit', ok: false, error: msg, elapsedMs: Date.now() - startMs },
      { status: 500 },
    );
  }

  // 2. Poll until succeeded / failed / timeout
  let polls = 0;
  while (polls < MAX_POLLS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
    polls++;

    let result: Awaited<ReturnType<typeof getVideoTask>>;
    try {
      result = await getVideoTask(jobId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { phase: 'poll', ok: false, jobId, polls, error: msg, elapsedMs: Date.now() - startMs },
        { status: 500 },
      );
    }

    if (result.status === 'succeeded') {
      return NextResponse.json({
        ok:        true,
        jobId,
        polls,
        elapsedMs: Date.now() - startMs,
        video_url: result.video_url,
        message:   '✅ Seedance video generation works end-to-end.',
      });
    }

    if (result.status === 'failed') {
      return NextResponse.json(
        {
          ok:        false,
          jobId,
          polls,
          elapsedMs: Date.now() - startMs,
          error:     result.error ?? 'Task failed with no error message',
          phase:     'generation_failed',
        },
        { status: 500 },
      );
    }

    // still pending / processing — keep polling
  }

  // Timed out — but the job was submitted successfully, it's just slow
  return NextResponse.json({
    ok:        null,
    jobId,
    polls,
    elapsedMs: Date.now() - startMs,
    message:   'Job submitted and is still processing after 90 s. Poll manually with GET /api/admin/seedance/' + jobId,
  });
}
