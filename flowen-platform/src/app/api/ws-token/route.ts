import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import * as Sentry from '@sentry/nextjs';

// WS_TOKEN_SECRET must be a 32-byte+ random string known to the edge gateway.
// Generate with: openssl rand -base64 32
// Set in Vercel env: WS_TOKEN_SECRET=<value>
function getSecret(): Uint8Array {
  const secret = process.env.WS_TOKEN_SECRET;
  if (!secret) {
    throw new Error('[ws-token] WS_TOKEN_SECRET env var is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Sign a short-lived JWT (30-minute expiration) with HMAC-SHA256.
    // The edge gateway at wss://edge-inference.flowen.app verifies this
    // signature using the same WS_TOKEN_SECRET before accepting the connection.
    const token = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('flowen-edge-gateway')
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(getSecret());

    return NextResponse.json({
      token,
      endpoint: 'wss://edge-inference.flowen.app/v1/stream',
      expiresIn: 1800,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[ws-token] error:', err);
    return NextResponse.json({ error: 'Failed to issue token' }, { status: 500 });
  }
}
