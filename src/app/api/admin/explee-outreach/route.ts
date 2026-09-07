/**
 * /api/admin/explee-outreach
 *
 * Read-only view over the data /api/cron/explee-outreach-sync collects —
 * this route never talks to Explee itself, just reads what's already
 * synced into Postgres, so /admin/outreach loads instantly regardless of
 * Explee's own latency.
 *
 * GET ?person=<person_id>&campaign=<campaign_id> — one contact's full
 *   message thread (for the expand-to-read-the-emails view).
 * GET (no params) — project rollup: latest analytics snapshot, every
 *   campaign, and a page of contacts (newest activity first).
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const EXPLEE_PROJECT_ID = 33901;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const personId = searchParams.get('person');
  const campaignId = searchParams.get('campaign');
  const supabase = db();

  if (personId && campaignId) {
    const { data: messages, error } = await supabase
      .from('explee_messages').select('*')
      .eq('campaign_id', Number(campaignId)).eq('person_id', personId)
      .order('sent_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages });
  }

  const [{ data: snapshot }, { data: campaigns }, { data: contacts }] = await Promise.all([
    supabase.from('explee_analytics_snapshots').select('*')
      .eq('project_id', EXPLEE_PROJECT_ID).order('captured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('explee_campaigns').select('*').order('emails_sent', { ascending: false }),
    supabase.from('explee_contacts').select('*')
      .order('latest_reply_at', { ascending: false, nullsFirst: false })
      .order('latest_sent_at', { ascending: false, nullsFirst: false })
      .limit(300),
  ]);

  return NextResponse.json({ snapshot: snapshot ?? null, campaigns: campaigns ?? [], contacts: contacts ?? [] });
}
