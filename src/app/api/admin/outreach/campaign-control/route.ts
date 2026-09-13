/**
 * POST /api/admin/outreach/campaign-control
 *
 * Start/stop a campaign, or set its daily budget, directly from
 * /admin/outreach. Explee is the source of truth for all of it — this
 * just forwards the action and refreshes the cached explee_campaigns row
 * immediately so the admin UI reflects it without waiting for the next
 * 10-minute sync.
 *
 * Body: { campaignId, action: 'start' | 'stop' }
 *    or { campaignId, action: 'set_budget', dailyLimitUsd }
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

interface ControlBody {
  campaignId?: number;
  action?: 'start' | 'stop' | 'set_budget';
  dailyLimitUsd?: number;
}

function explainStatus(res: Response, data: { error?: string }): string {
  if (res.status === 409) {
    return data.error ?? 'Blocked — Autopilot may be controlling this campaign, or it needs to be running first.';
  }
  if (res.status === 402) return 'Insufficient Explee credit balance — top up at explee.com/billing.';
  return data.error ?? `Explee error (HTTP ${res.status})`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as ControlBody;
  const { campaignId, action } = body;
  if (!campaignId || !action) return NextResponse.json({ error: 'campaignId and action are required' }, { status: 422 });

  const supabase = db();

  if (action === 'start' || action === 'stop') {
    let res: Response;
    try {
      res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/campaigns/${campaignId}/${action}`, {
        method: 'POST', headers: expleeHeaders(),
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
    }
    const data = await res.json().catch(() => ({})) as { accepted?: boolean; error?: string };
    if (!res.ok || !data.accepted) return NextResponse.json({ error: explainStatus(res, data) }, { status: res.status || 500 });

    // Optimistic status refresh — the next sync (every 10 min) will
    // reconcile against Explee's real analytics anyway, but the admin
    // shouldn't have to wait that long to see their own click take effect.
    await supabase.from('explee_campaigns')
      .update({ status: action === 'stop' ? 'stopped' : 'outreach' })
      .eq('id', campaignId);

    return NextResponse.json({ ok: true });
  }

  if (action === 'set_budget') {
    const dailyLimitUsd = body.dailyLimitUsd;
    if (!dailyLimitUsd || dailyLimitUsd < 1 || dailyLimitUsd > 300) {
      return NextResponse.json({ error: 'dailyLimitUsd must be between 1 and 300' }, { status: 422 });
    }
    let res: Response;
    try {
      res = await fetch(`${EXPLEE_BASE}/public/api/v1/autogtm/campaigns/${campaignId}/budget`, {
        method: 'PATCH', headers: expleeHeaders(), body: JSON.stringify({ daily_limit_usd: dailyLimitUsd }),
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Explee request failed' }, { status: 502 });
    }
    const data = await res.json().catch(() => ({})) as { daily_limit_usd?: number; error?: string };
    if (!res.ok || data.daily_limit_usd === undefined) {
      return NextResponse.json({ error: explainStatus(res, data) }, { status: res.status || 500 });
    }

    await supabase.from('explee_campaigns').update({ daily_budget_usd: data.daily_limit_usd }).eq('id', campaignId);
    return NextResponse.json({ ok: true, dailyLimitUsd: data.daily_limit_usd });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 422 });
}
