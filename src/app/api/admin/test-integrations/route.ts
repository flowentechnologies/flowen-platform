/**
 * TEMPORARY — integration smoke test (secret-token gated).
 * Tests ElevenLabs IVC eligibility and Seedance model activation.
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

  // ── ElevenLabs subscription check ─────────────────────────────────────────
  try {
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (!elKey) {
      results.elevenlabs = { ok: false, error: 'ELEVENLABS_API_KEY not set' };
    } else {
      const subRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': elKey },
      });
      const sub = await subRes.json() as Record<string, unknown>;
      if (!subRes.ok) {
        results.elevenlabs = { ok: false, status: subRes.status, error: sub };
      } else {
        results.elevenlabs = {
          ok: true,
          tier: sub.tier,
          character_count: sub.character_count,
          character_limit: sub.character_limit,
          voice_clones_used: sub.voice_add_edit_counter,
          voice_clones_max:  sub.max_voice_add_edits,
          can_use_ivc:       sub.can_use_instant_voice_cloning,
          status:            sub.status,
        };
      }
    }
  } catch (err) {
    results.elevenlabs = { ok: false, error: String(err) };
  }

  // ── Seedance 2.5 test task ─────────────────────────────────────────────────
  try {
    const bpKey = process.env.BYTEPLUS_API_KEY;
    const bpBase = process.env.BYTEPLUS_API_BASE ?? 'https://ark.ap-southeast.bytepluses.com/api/v3';
    if (!bpKey) {
      results.seedance = { ok: false, error: 'BYTEPLUS_API_KEY not set' };
    } else {
      const taskRes = await fetch(`${bpBase}/contents/generations/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bpKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dreamina-seedance-2-5-260628',
          content: [{ type: 'text', text: 'A calm blue sky with fluffy white clouds — 3 second smoke test' }],
          ratio: '16:9',
          generate_audio: false,
          watermark: false,
        }),
      });
      const task = await taskRes.json() as Record<string, unknown>;
      if (taskRes.ok && task.id) {
        results.seedance = { ok: true, task_id: task.id, status: task.status, model: 'dreamina-seedance-2-5-260628' };
        // Note: task starts generating — it will accrue a small charge.
        // The test just confirms the model is now activated.
      } else {
        results.seedance = { ok: false, http_status: taskRes.status, error: task };
      }
    }
  } catch (err) {
    results.seedance = { ok: false, error: String(err) };
  }

  return NextResponse.json(results);
}
