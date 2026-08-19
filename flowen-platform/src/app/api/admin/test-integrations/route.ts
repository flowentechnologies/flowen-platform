/**
 * Temporary smoke-test endpoint — DELETE AFTER USE
 * Auth: ?token=flowen-smoke-test-2026
 */
import { NextResponse } from 'next/server';

const SECRET = 'flowen-smoke-test-2026';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('token') !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // ── ElevenLabs: unrestricted key test ──────────────────────────────────────
  try {
    const elKey = process.env.ELEVENLABS_API_KEY ?? '';
    // /v1/user — requires user_read scope; was 401 on restricted key
    const userRes = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': elKey },
    });
    const userData = await userRes.json().catch(() => ({}));
    // /v1/user/subscription — also requires user_read
    const subRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      headers: { 'xi-api-key': elKey },
    });
    const subData = await subRes.json().catch(() => ({}));
    results.elevenlabs = {
      user_status:        userRes.status,
      subscription_status: subRes.status,
      tier:               (subData as { tier?: string }).tier ?? null,
      character_limit:    (subData as { character_limit?: number }).character_limit ?? null,
      user_ok:            userRes.ok,
      subscription_ok:    subRes.ok,
      user_detail:        userRes.ok ? undefined : userData,
      sub_detail:         subRes.ok ? undefined : subData,
    };
  } catch (e) {
    results.elevenlabs = { error: String(e) };
  }

  // ── Seedance: activation check for all 3 models ────────────────────────────
  const MODELS = [
    'dreamina-seedance-2-5-260628',
    'dreamina-seedance-2-0-260128',
    'dreamina-seedance-2-0-fast-260128',
  ];
  const BYTEPLUS_BASE = process.env.BYTEPLUS_API_BASE ?? 'https://ark.ap-southeast.bytepluses.com/api/v3';
  const BYTEPLUS_KEY  = process.env.BYTEPLUS_API_KEY  ?? '';

  const seedanceResults: Record<string, unknown> = {};
  for (const model of MODELS) {
    try {
      const res = await fetch(`${BYTEPLUS_BASE}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BYTEPLUS_KEY}`,
        },
        body: JSON.stringify({
          model,
          content: [{ type: 'text', text: 'A calm blue ocean wave' }],
          parameters: { ratio: '16:9', generate_audio: false, watermark: false },
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: { code?: string; message?: string }; id?: string };
      seedanceResults[model] = {
        status:   res.status,
        ok:       res.status !== 400 && data?.error?.code !== 'ModelNotOpen',
        error:    data?.error ?? null,
        task_id:  data?.id ?? null,
      };
    } catch (e) {
      seedanceResults[model] = { error: String(e) };
    }
  }
  results.seedance = seedanceResults;

  return NextResponse.json(results, { status: 200 });
}
