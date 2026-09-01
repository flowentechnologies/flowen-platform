import { NextResponse, type NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/supabase/admin';

const VS_COOKIE  = '__vs';
const UTM_COOKIE = '__utm';

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get(VS_COOKIE)?.value;
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 });

  let rawBody: { path?: string; referrer?: string };
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Clamp lengths to prevent unbounded writes to the DB
  const path     = (rawBody.path     ?? '').slice(0, 2048);
  const referrer = (rawBody.referrer ?? '').slice(0, 2048) || undefined;

  // Geo from Vercel headers (free, no external API)
  const country = req.headers.get('x-vercel-ip-country')      ?? null;
  const city    = req.headers.get('x-vercel-ip-city')          ?? null;
  const region  = req.headers.get('x-vercel-ip-country-region') ?? null;

  // UTM from cookie
  let utm: Record<string, string> = {};
  const utmRaw = req.cookies.get(UTM_COOKIE)?.value;
  if (utmRaw) {
    try { utm = JSON.parse(utmRaw); } catch { /* ignore */ }
  }

  const client = db();
  const now = new Date().toISOString();

  // Upsert visitor session
  const { data: existing } = await client
    .from('visitor_sessions')
    .select('id, page_view_count')
    .eq('id', sessionId)
    .single();

  if (!existing) {
    await client.from('visitor_sessions').insert({
      id:             sessionId,
      created_at:     now,
      last_seen_at:   now,
      country,
      city,
      region,
      landing_page:   path,
      referrer:       referrer ?? null,

      utm_source:     utm.utm_source   ?? null,
      utm_medium:     utm.utm_medium   ?? null,
      utm_campaign:   utm.utm_campaign ?? null,
      utm_term:       utm.utm_term     ?? null,
      utm_content:    utm.utm_content  ?? null,
      page_view_count: 1,
    });
  } else {
    await client
      .from('visitor_sessions')
      .update({
        last_seen_at:    now,
        page_view_count: (existing.page_view_count ?? 0) + 1,
      })
      .eq('id', sessionId);
  }

  // Log page view
  await client.from('page_views').insert({
    session_id: sessionId,
    path,
    referrer:   referrer ?? null,
    country,
    city,
  });

  return NextResponse.json({ ok: true });
}
