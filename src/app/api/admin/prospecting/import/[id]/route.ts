/**
 * GET /api/admin/prospecting/import/{id}
 *
 * Polls a campaign-import task. Once Explee reports it complete, marks
 * every prospect that was part of it (imported_campaign_id/imported_at)
 * so the search results view can show they're already in outreach.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

const EXPLEE_BASE = 'https://api.explee.com';

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key };
}

interface CampaignImportStatusResponse {
  status: 'pending' | 'completed' | 'failed';
  progress: { stage: string; done: number; total: number } | null;
  result: { campaign_id: number | null } | null;
  error: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { id } = await params;
  const supabase = db();
  const { data: importRow, error: fetchError } = await supabase.from('explee_campaign_imports').select('*').eq('id', id).maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!importRow) return NextResponse.json({ error: 'Import not found' }, { status: 404 });

  if (importRow.status !== 'pending') return NextResponse.json({ import: importRow });

  let res: Response;
  try {
    res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/campaigns/import/${importRow.task_id}`, { headers: expleeHeaders() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
  }
  const data = await res.json().catch(() => ({})) as CampaignImportStatusResponse & { error?: string };
  if (!res.ok) return NextResponse.json({ error: data.error ?? `Explee error (HTTP ${res.status})` }, { status: res.status });

  if (data.status === 'pending') return NextResponse.json({ import: importRow, progress: data.progress });

  const now = new Date().toISOString();
  if (data.status === 'failed') {
    await supabase.from('explee_campaign_imports').update({ status: 'failed', error: data.error, completed_at: now }).eq('id', id);
    return NextResponse.json({ import: { ...importRow, status: 'failed', error: data.error } });
  }

  const campaignId = data.result?.campaign_id ?? null;
  await supabase.from('explee_campaign_imports').update({ status: 'completed', campaign_id: campaignId, completed_at: now }).eq('id', id);
  if (campaignId && importRow.prospect_ids?.length) {
    await supabase.from('explee_prospects')
      .update({ imported_campaign_id: campaignId, imported_at: now })
      .in('id', importRow.prospect_ids);
  }

  return NextResponse.json({ import: { ...importRow, status: 'completed', campaign_id: campaignId } });
}
