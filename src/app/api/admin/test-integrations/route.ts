/**
 * TEMPORARY — admin-only integration smoke test.
 * Tests ElevenLabs IVC eligibility and Seedance model activation.
 * DELETE THIS FILE after testing.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await assertAdmin();
  } catch {
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
      results.elevenlabs = {
        ok: subRes.ok,
        tier: sub.tier,
        character_count: sub.character_count,
        character_limit: sub.character_limit,
        voice_clones_used: sub.voice_add_edit_counter,
        voice_clones_max:  sub.max_voice_add_edits,
        can_use_ivc:       sub.can_use_instant_voice_cloning,
        status:            sub.status,
        raw_error:         sub.detail ?? undefined,
      };
    }
  } catch (err) {
    results.elevenlabs = { ok: false, error: String(err) };
  }

  // ── Seedance 2.5 test task submission ─────────────────────────────────────
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
          content: [{ type: 'text', text: 'A simple test — calm blue sky with white clouds, 3 seconds' }],
          ratio: '16:9',
          generate_audio: false,
          watermark: false,
        }),
      });
      const task = await taskRes.json() as Record<string, unknown>;
      if (taskRes.ok && task.id) {
        // Model is activated — cancel immediately to avoid charges
        results.seedance = { ok: true, task_id: task.id, status: task.status, model: 'dreamina-seedance-2-5-260628' };
      } else {
        results.seedance = { ok: false, status: taskRes.status, error: task.error ?? task };
      }
    }
  } catch (err) {
    results.seedance = { ok: false, error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
