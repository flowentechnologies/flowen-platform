/**
 * PATCH /api/admin/social
 *
 * Two admin actions on a social_publish_queue row:
 *   { id, action: 'mark_manual_done' } — LinkedIn/Snapchat: admin has
 *     pasted the caption into the platform themselves and posted it
 *     manually.
 *   { id, action: 'retry' }            — Instagram/Facebook/Pinterest:
 *     reset a failed row back to pending so the next cron run retries it.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { id?: string; action?: string } | null;
  if (!body?.id || !body?.action) {
    return NextResponse.json({ error: 'id and action required' }, { status: 400 });
  }

  const client = db();

  if (body.action === 'mark_manual_done') {
    const { error } = await client.from('social_publish_queue').update({
      status: 'manual_done',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', body.id).in('platform', ['linkedin', 'snapchat']);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'retry') {
    const { error } = await client.from('social_publish_queue').update({
      status: 'pending',
      attempt_count: 0,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq('id', body.id).in('platform', ['instagram', 'facebook', 'pinterest']);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
