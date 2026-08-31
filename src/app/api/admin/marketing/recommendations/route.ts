/**
 * /api/admin/marketing/recommendations
 *
 * GET  — list all non-dismissed recommendations
 * POST — generate fresh recommendations from real data + approve/reject one
 *
 * Rules (hard-coded — never relax):
 * - AI may NEVER automatically change ad spend, campaign status, targeting, bids, or creatives
 * - All external changes require explicit admin approval (POST body: { action: 'approve', id })
 * - Confidence must reflect actual sample sizes
 * - Never invent data; show "Insufficient data" when appropriate
 * - Every approved action is logged immutably in recommendation_actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const client = adminDb();
  const { data, error } = await client
    .from('marketing_recommendations')
    .select('*')
    .neq('status', 'dismissed')
    .order('generated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: actions } = await client
    .from('recommendation_actions')
    .select('*')
    .order('approved_at', { ascending: false });

  return NextResponse.json({ recommendations: data ?? [], actions: actions ?? [] });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as {
    action?: 'generate' | 'approve' | 'reject' | 'dismiss';
    id?: string;
  };

  if (body.action === 'approve')  return approveRec(body.id!);
  if (body.action === 'reject')   return rejectRec(body.id!);
  if (body.action === 'dismiss')  return dismissRec(body.id!);

  // Default: generate recommendations from real data
  return generateRecommendations();
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function generateRecommendations() {
  const client = adminDb();

  // Gather real data — only make recommendations based on what we have
  const [adRes, waitlistRes, attrRes, activeSubRes, sessionRes, visitorRes] = await Promise.all([
    client.from('ad_platform_stats').select('*').limit(1000),
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    client.from('marketing_attribution').select('utm_source, utm_medium, utm_campaign, user_id').limit(500),
    client.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    client.from('practice_sessions').select('user_id').limit(5000),
    client.from('visitor_sessions').select('utm_source').limit(5000),
  ]);

  type AdRow = { spend_pence: number; impressions: number; clicks: number; campaign_id: string | null; ctr: number | null };
  type AttrRow = { utm_source: string | null; user_id: string | null };
  type VisRow  = { utm_source: string | null };

  const adRows     = (adRes.data ?? []) as AdRow[];
  const attrRows   = (attrRes.data ?? []) as AttrRow[];
  const visRows    = (visitorRes.data ?? []) as VisRow[];
  const waitlist   = waitlistRes.count ?? 0;
  const paidUsers  = activeSubRes.count ?? 0;
  const activated  = new Set(((sessionRes.data ?? []) as { user_id: string }[]).map(r => r.user_id)).size;
  const totalSpend = adRows.reduce((s, r) => s + (r.spend_pence ?? 0), 0);

  const recs: {
    section: string; finding: string; evidence: string;
    recommended_action: string; confidence: 'high' | 'medium' | 'low';
    risk: string; expected_impact: string; data_snapshot: object;
    expires_at: string;
  }[] = [];

  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString();

  // ── Recommendation 1: UTM coverage ────────────────────────────────────────
  const withUTM    = visRows.filter(r => r.utm_source).length;
  const utmCovPct  = visRows.length > 0 ? Math.round((withUTM / visRows.length) * 100) : null;

  if (utmCovPct !== null && utmCovPct < 80 && visRows.length >= 20) {
    recs.push({
      section: 'attribution',
      finding: `UTM parameter coverage is ${utmCovPct}% of visitor sessions`,
      evidence: `${withUTM} of ${visRows.length} recent visitor sessions have a utm_source. ${100 - utmCovPct}% of traffic is unattributed.`,
      recommended_action: 'Ensure all paid ad links include UTM parameters. Audit landing page URLs in Meta Ads Manager. Add utm_source=meta&utm_medium=cpc to all ad destination URLs.',
      confidence: visRows.length >= 100 ? 'high' : 'medium',
      risk: 'Low — UTM tagging is non-destructive and only affects attribution accuracy.',
      expected_impact: `Improve attribution coverage from ${utmCovPct}% toward 95%+. Enables accurate CPA calculation per campaign.`,
      data_snapshot: { utmCovPct, withUTM, total: visRows.length },
      expires_at: expiresAt,
    });
  }

  // ── Recommendation 2: Small sample size warning ────────────────────────────
  if (waitlist < 50 && totalSpend > 0) {
    recs.push({
      section: 'paid_media',
      finding: `Sample size is too small for reliable CPA optimisation (${waitlist} waitlist sign-ups)`,
      evidence: `Current dataset: £${(totalSpend / 100).toFixed(2)} spend, ${waitlist} waitlist sign-ups. Statistical significance for CPA requires at least 50–100 conversion events.`,
      recommended_action: 'Continue running campaigns without major bid/targeting changes. Collect data until ≥50 waitlist conversions before drawing optimisation conclusions.',
      confidence: 'high',
      risk: 'Low — this is an observation, not a change recommendation.',
      expected_impact: 'Prevents premature optimisation decisions that could harm performance with insufficient data.',
      data_snapshot: { waitlist, totalSpendPence: totalSpend },
      expires_at: expiresAt,
    });
  }

  // ── Recommendation 3: Attribution source analysis (only if enough data) ───
  const sourceCounts: Record<string, number> = {};
  for (const r of attrRows) {
    const src = r.utm_source ?? 'unattributed';
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];

  if (attrRows.length >= 20 && topSource) {
    const pct = Math.round((topSource[1] / attrRows.length) * 100);
    recs.push({
      section: 'attribution',
      finding: `${pct}% of attributed traffic comes from "${topSource[0]}"`,
      evidence: `${topSource[1]} of ${attrRows.length} attribution records have source="${topSource[0]}". Remaining ${100 - pct}% spread across other sources.`,
      recommended_action: pct > 80
        ? 'High source concentration detected. Consider diversifying to a second acquisition channel to reduce single-source dependency.'
        : 'Source mix is healthy. Continue monitoring as volume grows.',
      confidence: attrRows.length >= 50 ? 'medium' : 'low',
      risk: 'Low — observation only. No changes recommended without more data.',
      expected_impact: 'Informs channel diversification strategy.',
      data_snapshot: { sourceCounts, total: attrRows.length },
      expires_at: expiresAt,
    });
  }

  // ── Recommendation 4: No paid conversions yet ──────────────────────────────
  if (paidUsers === 0 && totalSpend > 0) {
    recs.push({
      section: 'paid_media',
      finding: 'No paid subscribers attributed to ad spend yet',
      evidence: `£${(totalSpend / 100).toFixed(2)} total ad spend with ${waitlist} waitlist sign-ups and 0 active paying subscribers.`,
      recommended_action: 'Review the full funnel: Waitlist → Account → Onboarding → Session → Checkout. Identify the step with the largest drop-off. Do not increase ad spend until the conversion funnel is validated.',
      confidence: 'high',
      risk: 'Low — this is an observation. Increasing spend before fixing the funnel wastes budget.',
      expected_impact: 'Prevents premature scale spend. Identifies where product-side conversion optimisation is needed first.',
      data_snapshot: { paidUsers, waitlist, totalSpendPence: totalSpend, activated },
      expires_at: expiresAt,
    });
  }

  // ── No data case ───────────────────────────────────────────────────────────
  if (adRows.length === 0) {
    recs.push({
      section: 'general',
      finding: 'Insufficient ad platform data for recommendations',
      evidence: 'No rows in ad_platform_stats. Sync Meta campaign data to enable AI recommendations.',
      recommended_action: 'Click "Sync from Meta" in the Campaigns tab to pull your ad performance data. Recommendations will be regenerated automatically after sync.',
      confidence: 'high',
      risk: 'None.',
      expected_impact: 'Enables data-driven recommendations once ad stats are available.',
      data_snapshot: { adRows: 0 },
      expires_at: expiresAt,
    });
  }

  if (recs.length === 0) {
    return NextResponse.json({ generated: 0, note: 'No new recommendations — data looks healthy or sample is too small.' });
  }

  // Expire any existing pending recommendations in the same sections
  const sections = [...new Set(recs.map(r => r.section))];
  await adminDb()
    .from('marketing_recommendations')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .in('section', sections)
    .eq('status', 'pending');

  const { data: inserted, error } = await adminDb()
    .from('marketing_recommendations')
    .insert(recs)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ generated: inserted?.length ?? 0, recommendations: inserted });
}

// ── Approve ───────────────────────────────────────────────────────────────────

async function approveRec(id: string) {
  const userId = await currentUserId();
  const client = adminDb();

  const { data: rec } = await client
    .from('marketing_recommendations')
    .select('*')
    .eq('id', id)
    .single();

  if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  if (rec.status !== 'pending') {
    return NextResponse.json({ error: `Cannot approve — status is "${rec.status}"` }, { status: 409 });
  }

  // Mark approved
  await client
    .from('marketing_recommendations')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: userId })
    .eq('id', id);

  // Immutable audit log entry
  await client.from('recommendation_actions').insert({
    recommendation_id: id,
    action:            rec.recommended_action,
    evidence:          rec.evidence,
    approved_by:       userId,
    approved_at:       new Date().toISOString(),
    execution_status:  'pending',
  });

  // ⚠ APPROVAL-FIRST: No automatic external changes are executed here.
  // The admin must manually carry out the recommended action.
  // Future: when execution is automated, add execution logic + update status here.

  return NextResponse.json({
    ok:   true,
    note: 'Recommendation approved and logged. Please carry out the recommended action manually — automated execution is not yet enabled.',
  });
}

// ── Reject ────────────────────────────────────────────────────────────────────

async function rejectRec(id: string) {
  const userId = await currentUserId();
  await adminDb()
    .from('marketing_recommendations')
    .update({ status: 'rejected', rejected_at: new Date().toISOString(), rejected_by: userId })
    .eq('id', id);
  return NextResponse.json({ ok: true });
}

// ── Dismiss ───────────────────────────────────────────────────────────────────

async function dismissRec(id: string) {
  await adminDb()
    .from('marketing_recommendations')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .eq('id', id);
  return NextResponse.json({ ok: true });
}
