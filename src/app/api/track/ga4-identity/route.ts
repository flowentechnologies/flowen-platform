import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { adminDb } from '@/lib/supabase/admin';
import { hasAdsConsent } from '@/lib/consent';
import { checkProxyRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!(await checkProxyRateLimit(ip, true))) return new NextResponse(null, { status: 429 });
  const jar = await cookies();
  const auth = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const anonymousId = jar.get('flowen_anon_id')?.value;
  if (!(await hasAdsConsent({ userId: user.id, anonymousId }))) return new NextResponse(null, { status: 403 });
  let body;
  try { body = await req.json(); } catch { return new NextResponse(null, { status: 400 }); }
  const { measurementId, clientId, sessionId } = body ?? {};
  if (typeof clientId !== 'string' || !/^\d+\.\d+$/.test(clientId) || clientId.length > 100 ||
      typeof measurementId !== 'string' || !/^G-[A-Z0-9]+$/.test(measurementId) ||
      typeof sessionId !== 'string' || !/^\d{1,16}$/.test(sessionId)) return new NextResponse(null, { status: 400 });
  const db = adminDb();
  const { data: provider } = await db.from('tracking_providers').select('pixel_id, enabled').eq('provider_key', 'ga4').maybeSingle();
  if (!provider?.enabled || provider.pixel_id !== measurementId) return new NextResponse(null, { status: 403 });
  const { error } = await db.from('analytics_identities').upsert({
    user_id: user.id, anonymous_id: anonymousId ?? null, measurement_id: measurementId,
    client_id: clientId, session_id: sessionId, captured_at: new Date().toISOString(),
  }, { onConflict: 'user_id,measurement_id' });
  return new NextResponse(null, { status: error ? 503 : 204 });
}
