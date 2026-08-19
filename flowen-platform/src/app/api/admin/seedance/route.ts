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

    // Surface region mismatch / model activation issues clearly
    if (/ModelNotOpen|model.*not.*open|model.*not.*activated/i.test(msg)) {
      const base = process.env.BYTEPLUS_API_BASE ?? 'https://ark.ap-southeast.bytepluses.com/api/v3';
      return NextResponse.json(
        {
          error:    'ModelNotOpen — the model is not activated on your account, or BYTEPLUS_API_BASE points to the wrong region.',
          detail:   msg,
          fix:      [
            `1. Run GET /api/admin/seedance-region to detect the correct regional endpoint for your API key.`,
            `2. Set BYTEPLUS_API_BASE in Vercel to the correct value and redeploy.`,
            `3. Activate the Seedance model in your console (Model Square → Seedance → Activate).`,
            `   • International: https://console.byteplus.com/ark`,
            `   • China:         https://console.volcengine.com/ark`,
            `Current BYTEPLUS_API_BASE: ${base}`,
          ],
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
