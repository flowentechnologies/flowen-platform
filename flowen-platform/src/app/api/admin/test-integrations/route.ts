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

  // ── ElevenLabs ─────────────────────────────────────────────────────────────
  try {
    const elKey = process.env.ELEVENLABS_API_KEY ?? '';
    const [userRes, subRes] = await Promise.all([
      fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': elKey } }),
      fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': elKey } }),
    ]);
    const userData = await userRes.json().catch(() => ({}));
    const subData  = await subRes.json().catch(() => ({}));
    results.elevenlabs = {
      user_ok:             userRes.ok,
      subscription_ok:     subRes.ok,
      tier:                (subData as Record<string, unknown>).tier ?? null,
      character_limit:     (subData as Record<string, unknown>).character_limit ?? null,
      can_use_ivc:         (subData as Record<string, unknown>).can_use_instant_voice_cloning ?? null,
      user_detail:         userRes.ok ? undefined : userData,
      sub_detail:          subRes.ok  ? undefined : subData,
    };
  } catch (e) {
    results.elevenlabs = { error: String(e) };
  }

  return NextResponse.json(results);
}
