/**
 * POST /api/admin/prospecting/import
 *
 * Creates a brand-new Explee campaign from selected prospects — the bridge
 * between "found these people" and "Explee is now emailing them". Free to
 * import itself (Explee's own pricing note); sends are billed as usual
 * once the campaign goes live.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { toImportLeads, type FoundProspect } from '@/lib/explee/prospecting';

const EXPLEE_BASE = 'https://api.explee.com';
const EXPLEE_PROJECT_ID = 33901;

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key, 'Content-Type': 'application/json' };
}

interface ImportRequestBody {
  prospectIds?: string[];
  campaignName?: string;
  instructions?: string;
  followupInstructions?: string;
  language?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as ImportRequestBody;
  if (!body.prospectIds?.length) return NextResponse.json({ error: 'Select at least one prospect' }, { status: 422 });
  if (!body.campaignName?.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 422 });

  const supabase = db();
  const { data: prospectRows, error: fetchError } = await supabase
    .from('explee_prospects').select('*').in('id', body.prospectIds);
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const { leads, skipped } = toImportLeads((prospectRows ?? []) as FoundProspect[]);
  if (leads.length === 0) {
    return NextResponse.json({ error: 'None of the selected prospects have enough data to import (need email, name, title, and company domain)' }, { status: 422 });
  }

  const payload: Record<string, unknown> = {
    project_id: EXPLEE_PROJECT_ID, name: body.campaignName.trim(), leads,
  };
  if (body.instructions?.trim()) payload.instructions = body.instructions.trim();
  if (body.followupInstructions?.trim()) payload.followup_instructions = body.followupInstructions.trim();
  if (body.language?.trim()) payload.language = body.language.trim();

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/campaigns/import`, {
      method: 'POST', headers: expleeHeaders(), body: JSON.stringify(payload),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as { task_id?: string; error?: string };
  if (!res.ok || !data.task_id) {
    return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status || 500 });
  }

  // toImportLeads drops skipped rows, so leads and prospectRows no longer
  // line up positionally — resolve which prospect ids actually got
  // submitted by matching on email instead.
  const submittedEmails = new Set(leads.map(l => l.email.toLowerCase()));
  const trackedIds = (prospectRows ?? [])
    .filter(p => p.email && submittedEmails.has(p.email.toLowerCase()))
    .map(p => p.id as string);

  const { data: created, error: insertError } = await supabase.from('explee_campaign_imports').insert({
    task_id: data.task_id, campaign_name: body.campaignName.trim(), prospect_ids: trackedIds,
    status: 'pending', created_by: admin.email ?? 'admin',
  }).select('id').single();
  if (insertError || !created) return NextResponse.json({ error: insertError?.message ?? 'Failed to record import' }, { status: 500 });

  return NextResponse.json({ importId: created.id, taskId: data.task_id, submitted: leads.length, skipped: skipped.length });
}
