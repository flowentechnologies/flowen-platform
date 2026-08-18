/**
 * POST /api/admin/seedance
 *
 * Submit a BytePlus Ark / Seedance 2.0 video generation task.
 * Returns { jobId } immediately — generation is async (30–120 s).
 * Poll GET /api/admin/seedance/[jobId] until status === "succeeded".
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import {
  createVideoTask,
  type SeedanceModel,
  type SeedanceRatio,
  type SeedanceResolution,
  type SeedanceStyle,
} from '@/lib/byteplus/seedance';

export const maxDuration = 30;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  try {
    const jobId = await createVideoTask({
      prompt,
      model:           body.model           as SeedanceModel | undefined,
      ratio:           body.ratio           as SeedanceRatio | undefined,
      resolution:      body.resolution      as SeedanceResolution | undefined,
      duration:        body.duration        ? Number(body.duration) : undefined,
      generate_audio:  body.generate_audio  !== false,
      style:           body.style           as SeedanceStyle | undefined,
      negative_prompt: body.negative_prompt as string | undefined,
      watermark:       false,
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/admin/seedance] submit error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
