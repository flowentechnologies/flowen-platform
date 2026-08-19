/**
 * TEMPORARY — integration smoke test (secret-token gated).
 * DELETE THIS FILE after testing.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SECRET = 'flowen-smoke-test-2026';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('token') !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // ── ElevenLabs: test what the key can actually do ──────────────────────────
  try {
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (!elKey) {
      results.elevenlabs = { ok: false, error: 'ELEVENLABS_API_KEY not set' };
    } else {
      // Try /v1/voices (needs voices:read scope — available on most key types)
      const voicesRes = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': elKey },
      });
      const voicesData = await voicesRes.json() as Record<string, unknown>;

      // Try /v1/user — simpler user info endpoint
      const userRes = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': elKey },
      });
      const userData = await userRes.json() as Record<string, unknown>;

      results.elevenlabs = {
        key_set: true,
        voices_endpoint: {
          ok: voicesRes.ok,
          status: voicesRes.status,
          voice_count: Array.isArray((voicesData as {voices?: unknown[]}).voices) ? (voicesData as {voices: unknown[]}).voices.length : 'N/A',
          error: voicesRes.ok ? undefined : voicesData,
        },
        user_endpoint: {
          ok: userRes.ok,
          status: userRes.status,
          subscription_tier: userRes.ok ? (userData as {subscription?: {tier?: string}}).subscription?.tier : undefined,
          can_use_ivc: userRes.ok ? (userData as {subscription?: {can_use_instant_voice_cloning?: boolean}}).subscription?.can_use_instant_voice_cloning : undefined,
          error: userRes.ok ? undefined : userData,
        },
      };
    }
  } catch (err) {
    results.elevenlabs = { ok: false, error: String(err) };
  }

  // ── Seedance: test all three model variants ────────────────────────────────
  const seedanceModels = [
    'dreamina-seedance-2-5-260628',
    'dreamina-seedance-2-0-260128',
    'dreamina-seedance-2-0-fast-260128',
  ];
  try {
    const bpKey = process.env.BYTEPLUS_API_KEY;
    const bpBase = process.env.BYTEPLUS_API_BASE ?? 'https://ark.ap-southeast.bytepluses.com/api/v3';
    if (!bpKey) {
      results.seedance = { ok: false, error: 'BYTEPLUS_API_KEY not set' };
    } else {
      const modelResults: Record<string, unknown> = {};
      for (const model of seedanceModels) {
        const taskRes = await fetch(`${bpBase}/contents/generations/tasks`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${bpKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            content: [{ type: 'text', text: 'smoke test — blue sky' }],
            ratio: '16:9',
            generate_audio: false,
            watermark: false,
          }),
        });
        const task = await taskRes.json() as Record<string, unknown>;
        modelResults[model] = taskRes.ok && task.id
          ? { ok: true, task_id: task.id }
          : { ok: false, error: (task as {error?: {code?: string; message?: string}}).error?.code ?? task };
      }
      const anyOk = Object.values(modelResults).some((r) => (r as {ok: boolean}).ok);
      results.seedance = { ok: anyOk, models: modelResults };
    }
  } catch (err) {
    results.seedance = { ok: false, error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
