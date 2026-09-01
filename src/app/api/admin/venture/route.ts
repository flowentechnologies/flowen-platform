import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Investor {
  id: string;
  name: string;
  firm: string | null;
  email: string | null;
  stage: string;
  last_contact_at: string | null;
  next_action: string | null;
  amount_pence: number | null;
  notes: string | null;
  created_at: string;
}

export interface VentureConfig {
  round_type: string | null;
  target_raise_pence: number | null;
  committed_pence: number | null;
  valuation_cap_pence: number | null;
  instrument: string | null;
  seis_advance_assurance: boolean;
  seis_limit_remaining_pence: number | null;
  eis_eligible: boolean;
  notes: string | null;
  monthly_burn_pence: number | null;
  cash_in_bank_pence: number | null;
  last_updated_at: string | null;
}

export interface VentureData {
  investors: Investor[];
  config: VentureConfig | null;
  kpis: {
    totalUsers: number;
    newUsersWeek: number;
    foundingCount: number;
    waitlistTotal: number;
    mrrPence: number;
    onboardedPct: number;
  };
}

// ── Column allowlists ──────────────────────────────────────────────────────────

const INVESTOR_COLUMNS = new Set([
  'name', 'firm', 'email', 'stage', 'last_contact_at',
  'next_action', 'amount_pence', 'notes',
]);

const VENTURE_CONFIG_COLUMNS = new Set([
  'round_type', 'target_raise_pence', 'committed_pence', 'valuation_cap_pence',
  'instrument', 'seis_advance_assurance', 'seis_limit_remaining_pence',
  'eis_eligible', 'notes', 'monthly_burn_pence', 'cash_in_bank_pence',
]);

function pick(obj: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.has(k)));
}

// ── MRR helper ────────────────────────────────────────────────────────────────
//
// Sums the monthly-equivalent revenue from all active Stripe subscriptions.
// Intervals are normalised to monthly: quarterly ÷ 3, six-monthly ÷ 6, yearly ÷ 12.
// Returns 0 on any Stripe error so the venture dashboard degrades gracefully when
// Stripe is not yet configured.

async function fetchMrrPence(): Promise<number> {
  try {
    const { client } = await getStripeClient();
    let mrrPence = 0;

    await client.subscriptions
      .list({ status: 'active', limit: 100 })
      .autoPagingEach((sub: Stripe.Subscription) => {
        for (const item of sub.items.data) {
          // price is a Price object (already included inline by Stripe API)
          const price = item.price as Stripe.Price;
          if (typeof price === 'string' || !price.unit_amount || !price.recurring) continue;

          const { interval, interval_count } = price.recurring;
          const grossPence = price.unit_amount * (item.quantity ?? 1);

          if (interval === 'month') {
            mrrPence += Math.round(grossPence / interval_count);
          } else if (interval === 'year') {
            // e.g. yearly plan: divide by 12 to get monthly equivalent
            mrrPence += Math.round(grossPence / (interval_count * 12));
          }
          // day / week intervals don't exist in Flowen's product; silently ignored
        }
      });

    return mrrPence;
  } catch {
    // Stripe not yet configured (placeholder key) or temporary API error
    return 0;
  }
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();

  // Fetch investors and config, gracefully handle missing tables
  const [investorsRes, configRes] = await Promise.all([
    client.from('investors').select('*').order('created_at', { ascending: false }),
    client.from('venture_config').select('*').eq('id', 1).maybeSingle(),
  ]);

  const investors: Investor[] = investorsRes.error ? [] : (investorsRes.data ?? []);
  const config: VentureConfig | null = configRes.error ? null : (configRes.data ?? null);

  // Real KPI queries — run in parallel (Stripe MRR alongside DB queries)
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [
    totalUsersRes,
    newUsersWeekRes,
    foundingRes,
    waitlistRes,
    onboardedUsersRes,
    allUsersRes,
    mrrPence,
  ] = await Promise.all([
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'founding'),
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    // Users who have at least 1 practice session (distinct user_ids)
    client.from('practice_sessions').select('user_id').limit(5000),
    client.from('profiles').select('id').limit(5000),
    fetchMrrPence(),
  ]);

  const totalUsers = totalUsersRes.count ?? 0;
  const newUsersWeek = newUsersWeekRes.count ?? 0;
  const foundingCount = foundingRes.count ?? 0;
  const waitlistTotal = waitlistRes.count ?? 0;

  // Onboarded = has at least one practice session
  const onboardedUserIds = new Set((onboardedUsersRes.data ?? []).map((r: { user_id: string }) => r.user_id));
  const allUserIds = (allUsersRes.data ?? []).length;
  const onboardedPct = allUserIds > 0 ? Math.round((onboardedUserIds.size / allUserIds) * 100) : 0;

  const data: VentureData = {
    investors,
    config,
    kpis: { totalUsers, newUsersWeek, foundingCount, waitlistTotal, mrrPence, onboardedPct },
  };

  return NextResponse.json(data);
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;
  const client = db();

  // ── add_investor ──────────────────────────────────────────────────────────

  if (action === 'add_investor') {
    const payload: Record<string, unknown> = {
      name:            body.name,
      firm:            body.firm    ?? null,
      email:           body.email   ?? null,
      stage:           body.stage   ?? 'researched',
      last_contact_at: body.last_contact_at ?? null,
      next_action:     body.next_action     ?? null,
      amount_pence:    body.amount_pence    ?? null,
      notes:           body.notes           ?? null,
    };
    const { data, error } = await client.from('investors').insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'investor.add', resource_type: 'investor', resource_id: data.id, metadata: { name: data.name, stage: data.stage }, severity: 'info' });
    return NextResponse.json({ data });
  }

  // ── update_investor ───────────────────────────────────────────────────────

  if (action === 'update_investor') {
    const { id, action: _a, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = pick(rest, INVESTOR_COLUMNS);
    const { data, error } = await client
      .from('investors')
      .update(fields)
      .eq('id', id as string)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'investor.update', resource_type: 'investor', resource_id: data.id, metadata: { stage: data.stage }, severity: 'info' });
    return NextResponse.json({ data });
  }

  // ── delete_investor ───────────────────────────────────────────────────────

  if (action === 'delete_investor') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await client.from('investors').delete().eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'investor.delete', resource_type: 'investor', resource_id: id as string, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  // ── update_config ─────────────────────────────────────────────────────────

  if (action === 'update_config') {
    const { action: _a, ...rest } = body;
    const fields = pick(rest, VENTURE_CONFIG_COLUMNS);
    const payload = { id: 1, updated_at: new Date().toISOString(), ...fields };
    const { data, error } = await client
      .from('venture_config')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'venture.config_update', resource_type: 'venture_config', resource_id: '1', severity: 'info' });
    return NextResponse.json({ data });
  }

  // ── update_runway ─────────────────────────────────────────────────────────

  if (action === 'update_runway') {
    const monthly_burn_pence = body.monthly_burn_pence ?? null;
    const cash_in_bank_pence = body.cash_in_bank_pence ?? null;
    const payload = {
      id: 1,
      monthly_burn_pence,
      cash_in_bank_pence,
      last_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await client
      .from('venture_config')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
