/**
 * GET/POST /api/admin/crm/explee-note
 *
 * Reads and writes Explee's own team-shared lead note (the same free-text
 * field the AutoGTM inbox's "Lead info" panel shows) — one shared string
 * per lead, last-write-wins, distinct from crm_contacts.notes which is
 * Flowen's own separate CRM note field. A write here also refreshes the
 * cached copy on explee_contacts so the CRM UI reflects it immediately
 * without waiting for the next sync run.
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

interface LeadNoteResponse {
  note: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('campaignId');
  const personId = searchParams.get('personId');
  if (!campaignId || !personId) {
    return NextResponse.json({ error: 'campaignId and personId are required' }, { status: 422 });
  }

  let res: Response;
  try {
    res = await fetch(
      `${EXPLEE_BASE}/public/api/v1/autogtm/campaigns/${campaignId}/inbox/${encodeURIComponent(personId)}/note`,
      { headers: expleeHeaders() },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as LeadNoteResponse & { error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as { campaignId?: number; personId?: string; note?: string | null };
  const { campaignId, personId } = body;
  if (!campaignId || !personId) {
    return NextResponse.json({ error: 'campaignId and personId are required' }, { status: 422 });
  }

  let res: Response;
  try {
    res = await fetch(
      `${EXPLEE_BASE}/public/api/v1/autogtm/campaigns/${campaignId}/inbox/${encodeURIComponent(personId)}/note`,
      { method: 'POST', headers: expleeHeaders(), body: JSON.stringify({ note: body.note ?? null }) },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as LeadNoteResponse & { error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });

  // Refresh the cached copy immediately — don't make the admin wait for
  // the next 10-minute sync to see their own edit reflected.
  await db().from('explee_contacts').update({
    explee_note: data.note, explee_note_updated_at: data.updated_at, explee_note_updated_by: data.updated_by,
  }).eq('campaign_id', campaignId).eq('person_id', personId);

  return NextResponse.json(data);
}
