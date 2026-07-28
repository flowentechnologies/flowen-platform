import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
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

  // Generate short-lived Base64 WS token (30-minute expiration)
  const payload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + (30 * 60),
    iss: 'flowen-edge-gateway',
  };

  const token = Buffer.from(JSON.stringify(payload)).toString('base64');

  return NextResponse.json({
    token,
    endpoint: 'wss://edge-inference.flowen.app/v1/stream',
    expiresIn: 1800,
  });
}
