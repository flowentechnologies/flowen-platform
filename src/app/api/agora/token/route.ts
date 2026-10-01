/**
 * POST /api/agora/token
 *
 * Server-side Agora RTC token generator. Returns a short-lived RTC token
 * that the client uses to join a channel. Never exposes AGORA_APP_CERTIFICATE
 * to the browser.
 *
 * Body: { channel: string; uid: number }
 * Response: { token: string; appId: string; channel: string; uid: number; expiresAt: number }
 */
import { NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { getUserFromRequest } from '@/lib/supabase/from-request';
import { ownerChannel, AGENT_UID } from '@/lib/agora/ownership';

const TOKEN_TTL_SECONDS = 3600; // 1 hour

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { uid?: number };
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
          (parsed.uid !== undefined && (!Number.isInteger(parsed.uid) || parsed.uid < 0 || parsed.uid > 0xffffffff || parsed.uid === AGENT_UID))) throw new Error();
      body = parsed;
    } catch {
      return NextResponse.json({ error: 'Invalid UID' }, { status: 400 });
    }
    // Force channel to the caller's own deterministic ID — ignore any client-supplied
    // channel name to prevent an authenticated user from obtaining a token for another
    // user's session channel.
    const channel = ownerChannel(user.id);
    const uid = body.uid ?? 0; // 0 = auto-assign

    const appId = process.env.AGORA_APP_ID;
    const appCert = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCert) {
      return NextResponse.json({ error: 'Agora not configured' }, { status: 503 });
    }

    const now = Math.floor(Date.now() / 1000);
    const privilegeExpire = now + TOKEN_TTL_SECONDS;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCert,
      channel,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpire,
      privilegeExpire,
    );

    return NextResponse.json({
      token,
      appId,
      channel,
      uid,
      expiresAt: privilegeExpire,
    });
  } catch (err) {
    console.error('[agora/token] error:', err);
    return NextResponse.json({ error: 'Token generation failed' }, { status: 500 });
  }
}
