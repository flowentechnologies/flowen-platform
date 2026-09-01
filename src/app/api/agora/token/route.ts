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
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const TOKEN_TTL_SECONDS = 3600; // 1 hour

export async function POST(req: Request) {
  try {
    // Require authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as { uid?: number };
    // Force channel to the caller's own deterministic ID — ignore any client-supplied
    // channel name to prevent an authenticated user from obtaining a token for another
    // user's session channel.
    const channel = `flowen-${user.id.replace(/-/g, '').slice(0, 16)}`;
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
