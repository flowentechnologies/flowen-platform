import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/admin/audit';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ValuationConfig {
  id:                         string;
  // Berkus
  berkus_sound_idea:          number;
  berkus_prototype:           number;
  berkus_management_team:     number;
  berkus_strategic_rel:       number;
  berkus_product_rollout:     number;
  // Scorecard
  scorecard_median_pence:     number;
  scorecard_team:             number;
  scorecard_market_size:      number;
  scorecard_product_tech:     number;
  scorecard_competition:      number;
  scorecard_marketing:        number;
  scorecard_investment_need:  number;
  scorecard_other:            number;
  // ARR
  arr_multiple:               number;
  // VC
  vc_exit_valuation_pence:    number;
  vc_investment_pence:        number;
  vc_years_to_exit:           number;
  vc_required_irr:            number;
  // Comparable
  comp_arr_multiple_low:      number;
  comp_arr_multiple_high:     number;
  comp_baseline_pence:        number;
  comp_traction_premium_pct:  number;
  // DCF
  dcf_discount_rate:          number;
  dcf_terminal_multiple:      number;
  dcf_year1_revenue_pence:    number;
  dcf_year2_revenue_pence:    number;
  dcf_year3_revenue_pence:    number;
  // NHS
  nhs_price_per_patient_pence: number;
  nhs_patients_per_icb:       number;
  nhs_icb_count:              number;
  nhs_probability_pct:        number;

  updated_at:                 string;
}

export interface ValuationSnapshot {
  id:             string;
  label:          string;
  low_pence:      number;
  mid_pence:      number;
  high_pence:     number;
  method_outputs: Record<string, number>;
  mrr_pence:      number | null;
  total_users:    number | null;
  round_context:  string | null;
  note:           string | null;
  created_at:     string;
}

export interface LiveKpis {
  mrrPence:      number;
  totalUsers:    number;
  waitlistTotal: number;
  foundingCount: number;
}

export interface RoadmapStatus {
  id:     string;
  phase:  string;
  title:  string;
  status: string;
  category: string;
}

// ── DB client ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();

  const [configRes, snapshotsRes, profilesRes, subscriptionsRes, waitlistRes, milestonesRes] = await Promise.all([
    client.from('valuation_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('valuation_snapshots').select('*').order('created_at', { ascending: false }).limit(20),
    client.from('profiles').select('id, tier'),
    client.from('subscriptions').select('amount_pence, status, billing_period').eq('status', 'active'),
    client.from('waitlist').select('id', { count: 'exact', head: true }),
    client.from('roadmap_milestones').select('id, phase, title, status, category'),
  ]);

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const profiles = profilesRes.data ?? [];
  const totalUsers = profiles.length;
  const foundingCount = profiles.filter((p: { tier: string | null }) => p.tier === 'founding').length;

  const subs = subscriptionsRes.data ?? [];
  let mrrPence = 0;
  for (const s of subs) {
    const amt = s.amount_pence ?? 0;
    mrrPence += s.billing_period === 'annual' ? Math.round(amt / 12) : amt;
  }

  const waitlistTotal = (waitlistRes as { count: number | null }).count ?? 0;

  const kpis: LiveKpis = { mrrPence, totalUsers, waitlistTotal, foundingCount };

  return NextResponse.json({
    config:     configRes.data ?? null,
    snapshots:  snapshotsRes.data ?? [],
    kpis,
    milestones: milestonesRes.data ?? [],
  });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const { action } = body;
  const client = db();

  // ── save_config ───────────────────────────────────────────────────────────────

  if (action === 'save_config') {
    // Check if row already exists
    const { data: existing } = await client.from('valuation_config').select('id').limit(1).maybeSingle();

    const payload = {
      berkus_sound_idea:           body.berkus_sound_idea,
      berkus_prototype:            body.berkus_prototype,
      berkus_management_team:      body.berkus_management_team,
      berkus_strategic_rel:        body.berkus_strategic_rel,
      berkus_product_rollout:      body.berkus_product_rollout,
      scorecard_median_pence:      body.scorecard_median_pence,
      scorecard_team:              body.scorecard_team,
      scorecard_market_size:       body.scorecard_market_size,
      scorecard_product_tech:      body.scorecard_product_tech,
      scorecard_competition:       body.scorecard_competition,
      scorecard_marketing:         body.scorecard_marketing,
      scorecard_investment_need:   body.scorecard_investment_need,
      scorecard_other:             body.scorecard_other,
      arr_multiple:                body.arr_multiple,
      vc_exit_valuation_pence:     body.vc_exit_valuation_pence,
      vc_investment_pence:         body.vc_investment_pence,
      vc_years_to_exit:            body.vc_years_to_exit,
      vc_required_irr:             body.vc_required_irr,
      comp_arr_multiple_low:       body.comp_arr_multiple_low,
      comp_arr_multiple_high:      body.comp_arr_multiple_high,
      comp_baseline_pence:         body.comp_baseline_pence,
      comp_traction_premium_pct:   body.comp_traction_premium_pct,
      dcf_discount_rate:           body.dcf_discount_rate,
      dcf_terminal_multiple:       body.dcf_terminal_multiple,
      dcf_year1_revenue_pence:     body.dcf_year1_revenue_pence,
      dcf_year2_revenue_pence:     body.dcf_year2_revenue_pence,
      dcf_year3_revenue_pence:     body.dcf_year3_revenue_pence,
      nhs_price_per_patient_pence: body.nhs_price_per_patient_pence,
      nhs_patients_per_icb:        body.nhs_patients_per_icb,
      nhs_icb_count:               body.nhs_icb_count,
      nhs_probability_pct:         body.nhs_probability_pct,
      updated_at:                  new Date().toISOString(),
    };

    let data, error;
    if (existing?.id) {
      ({ data, error } = await client.from('valuation_config').update(payload).eq('id', existing.id).select().single());
    } else {
      ({ data, error } = await client.from('valuation_config').insert(payload).select().single());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'valuation.config_update', resource_type: 'valuation_config', resource_id: data.id, metadata: {}, severity: 'info' });
    return NextResponse.json({ config: data });
  }

  // ── save_snapshot ─────────────────────────────────────────────────────────────

  if (action === 'save_snapshot') {
    const { data, error } = await client
      .from('valuation_snapshots')
      .insert({
        label:          body.label,
        low_pence:      body.low_pence,
        mid_pence:      body.mid_pence,
        high_pence:     body.high_pence,
        method_outputs: body.method_outputs ?? {},
        mrr_pence:      body.mrr_pence      ?? null,
        total_users:    body.total_users     ?? null,
        round_context:  body.round_context   ?? null,
        note:           body.note            ?? null,
      })
      .select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'valuation.snapshot_save', resource_type: 'valuation_snapshot', resource_id: data.id, metadata: { label: data.label }, severity: 'info' });
    return NextResponse.json({ snapshot: data });
  }

  // ── delete_snapshot ───────────────────────────────────────────────────────────

  if (action === 'delete_snapshot') {
    const { error } = await client.from('valuation_snapshots').delete().eq('id', body.id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
