/**
 * POST /api/admin/xero/disconnect  { entity: 'group' | 'ip' | 'speech-technologies' | 'labs' }
 *
 * Clears one entity's Xero connection — the fix for "this entity somehow got
 * connected to the wrong organisation" (e.g. Xero's org picker defaulting to
 * an org you'd already authorised for a different entity) without deleting
 * the whole row's history via a Supabase console. Just deletes the row;
 * reconnecting via /api/admin/xero/connect?entity=... upserts a fresh one.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { isXeroEntitySlug } from '@/lib/flowen-entities';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as { entity?: string };
  if (!body.entity || !isXeroEntitySlug(body.entity)) {
    return NextResponse.json({ error: 'entity is required (group, ip, speech-technologies, or labs)' }, { status: 400 });
  }

  const { error } = await db().from('xero_oauth_tokens').delete().eq('entity', body.entity);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entity: body.entity });
}
