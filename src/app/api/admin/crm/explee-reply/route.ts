/**
 * POST /api/admin/crm/explee-reply
 *
 * Sends an admin's reply to an Explee lead directly from Flowen's CRM,
 * instead of switching to the Explee app. Explee resolves the recipient,
 * subject and threading itself from the contact's real conversation — this
 * only ever forwards the message text, campaign_id and person_id.
 *
 * Explee only allows this for a contact who has replied and isn't
 * unsubscribed (`can_reply`, stored on explee_contacts from the last
 * thread sync) — this route defers to Explee's own compliance gate rather
 * than re-checking can_reply itself, so a 403 here always reflects
 * Explee's live, current answer, not a possibly-stale cached flag.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const EXPLEE_BASE = 'https://api.explee.com';

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key, 'Content-Type': 'application/json' };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as { campaignId?: number; personId?: string; message?: string };
  const { campaignId, personId, message } = body;
  if (!campaignId || !personId || !message?.trim()) {
    return NextResponse.json({ error: 'campaignId, personId and message are required' }, { status: 422 });
  }

  let res: Response;
  try {
    res = await fetch(
      `${EXPLEE_BASE}/public/api/v1/autogtm/campaigns/${campaignId}/inbox/${encodeURIComponent(personId)}/reply`,
      { method: 'POST', headers: expleeHeaders(), body: JSON.stringify({ body_text: message.trim() }) },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }

  const data = await res.json().catch(() => ({})) as { ok?: boolean; sent_email_id?: string; status?: string; error?: string };
  if (!res.ok) {
    const message =
      res.status === 403 ? 'Explee blocked this reply — the contact may have unsubscribed, or never replied.' :
      res.status === 429 ? 'Too many replies to this contact in the last 24h.' :
      data.error ?? `Explee error (HTTP ${res.status})`;
    return NextResponse.json({ error: message }, { status: res.status });
  }

  // Log it on the CRM timeline so a reply sent here shows up next to every
  // other touch on this contact, not just inside Explee's own inbox.
  const supabase = db();
  const { data: contactRow } = await supabase
    .from('explee_contacts').select('crm_contact_id').eq('campaign_id', campaignId).eq('person_id', personId).maybeSingle();
  if (contactRow?.crm_contact_id) {
    await supabase.from('crm_activities').insert({
      crm_contact_id: contactRow.crm_contact_id, type: 'email_outbound',
      body: `Reply sent via Explee by ${admin.email ?? 'admin'}: "${message.trim().slice(0, 200)}"`,
    });
  }

  return NextResponse.json({ ok: true, sentEmailId: data.sent_email_id, status: data.status });
}
