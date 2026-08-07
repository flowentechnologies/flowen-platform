import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/admin/audit';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AffiliateTier    = 'standard' | 'premium' | 'partner';
export type AffiliateStatus  = 'pending' | 'active' | 'suspended' | 'rejected';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled';
export type PayoutStatus     = 'pending' | 'processing' | 'paid' | 'failed';
export type ConversionEvent  = 'signup' | 'subscription' | 'renewal';

export interface Affiliate {
  id:               string;
  user_id:          string | null;
  name:             string;
  email:            string;
  code:             string;
  tier:             AffiliateTier;
  status:           AffiliateStatus;
  commission_pct:   number;
  recurring_months: number;
  channel:          string | null;
  website:          string | null;
  notes:            string | null;
  approved_at:      string | null;
  created_at:       string;
  updated_at:       string;
}

export interface AffiliateConversion {
  id:               string;
  affiliate_id:     string;
  referred_user_id: string | null;
  event_type:       ConversionEvent;
  subscription_id:  string | null;
  amount_pence:     number | null;
  notes:            string | null;
  created_at:       string;
}

export interface AffiliateCommission {
  id:            string;
  affiliate_id:  string;
  conversion_id: string | null;
  amount_pence:  number;
  status:        CommissionStatus;
  description:   string | null;
  payout_id:     string | null;
  approved_at:   string | null;
  created_at:    string;
}

export interface AffiliatePayout {
  id:               string;
  affiliate_id:     string;
  amount_pence:     number;
  commission_count: number;
  status:           PayoutStatus;
  payment_method:   string | null;
  payment_ref:      string | null;
  notes:            string | null;
  paid_at:          string | null;
  created_at:       string;
}

// Enriched affiliate with aggregated stats
export interface AffiliateWithStats extends Affiliate {
  click_count:      number;
  conversion_count: number;
  total_earned_pence: number;
  total_paid_pence:   number;
  pending_pence:      number;
}

// ── DB client ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Code generator ─────────────────────────────────────────────────────────────

function generateCode(name: string): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('-');
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base || 'AFF'}-${suffix}`;
}

// ── Seed data ──────────────────────────────────────────────────────────────────

const SEED_AFFILIATES = [
  {
    name: 'Jane Williams (SLT)',
    email: 'jane@speechworks.co.uk',
    code: 'SLT-JANE',
    tier: 'premium',
    status: 'active',
    commission_pct: 10.00,
    recurring_months: 6,
    channel: 'SLT community',
    website: 'https://speechworks.co.uk',
    approved_at: new Date().toISOString(),
    notes: 'RCSLT member, 800 Twitter followers. Specialises in paediatric speech.',
  },
  {
    name: 'SEND Support Birmingham',
    email: 'coordinator@sendbirmingham.org',
    code: 'SEND-BHAM',
    tier: 'partner',
    status: 'active',
    commission_pct: 15.00,
    recurring_months: 12,
    channel: 'SEND school',
    website: 'https://sendbirmingham.org',
    approved_at: new Date().toISOString(),
    notes: 'Partnership with 3 SEND schools. Refer staff and families.',
  },
  {
    name: 'The Stammer Space (Blog)',
    email: 'hello@stammers.co.uk',
    code: 'STAMMER-SPACE',
    tier: 'standard',
    status: 'active',
    commission_pct: 7.50,
    recurring_months: 3,
    channel: 'social',
    website: 'https://stammers.co.uk',
    approved_at: new Date().toISOString(),
    notes: 'Stuttering community blog, ~2k monthly readers.',
  },
  {
    name: 'Dr Priya Patel (NHS SLT)',
    email: 'priya.patel@nhs.net',
    code: 'NHS-PRIYA',
    tier: 'premium',
    status: 'pending',
    commission_pct: 10.00,
    recurring_months: 6,
    channel: 'NHS referral',
    website: null,
    approved_at: null,
    notes: 'Community SLT, referred by Jane Williams. Awaiting GDPR compliance check.',
  },
];

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();

  const [affiliatesRes, clicksRes, conversionsRes, commissionsRes, payoutsRes] = await Promise.all([
    client.from('affiliates').select('*').order('created_at', { ascending: false }),
    client.from('affiliate_clicks').select('affiliate_id'),
    client.from('affiliate_conversions').select('affiliate_id, amount_pence'),
    client.from('affiliate_commissions').select('affiliate_id, amount_pence, status'),
    client.from('affiliate_payouts').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  const affiliates: Affiliate[] = affiliatesRes.data ?? [];
  const clicks:      { affiliate_id: string }[]                   = clicksRes.data ?? [];
  const conversions: { affiliate_id: string; amount_pence: number | null }[] = conversionsRes.data ?? [];
  const commissions: { affiliate_id: string; amount_pence: number; status: string }[] = commissionsRes.data ?? [];
  const payouts:     AffiliatePayout[] = payoutsRes.data ?? [];

  // Aggregate stats per affiliate
  const affiliatesWithStats: AffiliateWithStats[] = affiliates.map(a => {
    const clickCount      = clicks.filter(c => c.affiliate_id === a.id).length;
    const conversionCount = conversions.filter(c => c.affiliate_id === a.id).length;
    const myCommissions   = commissions.filter(c => c.affiliate_id === a.id);
    const totalEarned     = myCommissions.reduce((s, c) => s + c.amount_pence, 0);
    const totalPaid       = myCommissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount_pence, 0);
    const pending         = myCommissions.filter(c => c.status === 'pending' || c.status === 'approved').reduce((s, c) => s + c.amount_pence, 0);

    return {
      ...a,
      click_count:        clickCount,
      conversion_count:   conversionCount,
      total_earned_pence: totalEarned,
      total_paid_pence:   totalPaid,
      pending_pence:      pending,
    };
  });

  // Program-level summary
  const summary = {
    total_affiliates:    affiliates.length,
    active_affiliates:   affiliates.filter(a => a.status === 'active').length,
    pending_affiliates:  affiliates.filter(a => a.status === 'pending').length,
    total_clicks:        clicks.length,
    total_conversions:   conversions.length,
    total_earned_pence:  commissions.reduce((s, c) => s + c.amount_pence, 0),
    total_paid_pence:    commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount_pence, 0),
    pending_payout_pence: commissions.filter(c => c.status === 'approved').reduce((s, c) => s + c.amount_pence, 0),
  };

  return NextResponse.json({ affiliates: affiliatesWithStats, payouts, summary });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const { action } = body;
  const client = db();

  // ── seed ─────────────────────────────────────────────────────────────────────
  if (action === 'seed') {
    const { count } = await client.from('affiliates').select('*', { count: 'exact', head: true });
    if ((count ?? 0) >= 2) return NextResponse.json({ skipped: true });
    const { data, error } = await client.from('affiliates').insert(SEED_AFFILIATES).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ seeded: data?.length ?? 0 });
  }

  // ── add_affiliate ─────────────────────────────────────────────────────────────
  if (action === 'add_affiliate') {
    const code = (body.code as string)?.trim() || generateCode(body.name as string);
    const { data, error } = await client.from('affiliates').insert({
      name:             body.name,
      email:            body.email,
      code:             code.toUpperCase(),
      tier:             body.tier             ?? 'standard',
      status:           body.status           ?? 'pending',
      commission_pct:   body.commission_pct   ?? 7.5,
      recurring_months: body.recurring_months ?? 3,
      channel:          body.channel          ?? null,
      website:          body.website          ?? null,
      notes:            body.notes            ?? null,
      updated_at:       new Date().toISOString(),
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'affiliate.add', resource_type: 'affiliate', resource_id: data.id, metadata: { name: data.name, code: data.code }, severity: 'info' });
    return NextResponse.json({ affiliate: data });
  }

  // ── update_affiliate ──────────────────────────────────────────────────────────
  if (action === 'update_affiliate') {
    const { id, ...fields } = body;
    const { action: _a, ...rest } = fields as Record<string, unknown>;
    const allowed = new Set(['name','email','code','tier','status','commission_pct','recurring_months','channel','website','notes']);
    const payload = Object.fromEntries(Object.entries(rest).filter(([k]) => allowed.has(k)));
    payload.updated_at = new Date().toISOString();
    if ((payload.status as string) === 'active' && !body.approved_at) payload.approved_at = new Date().toISOString();

    const { data, error } = await client.from('affiliates').update(payload).eq('id', id as string).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'affiliate.update', resource_type: 'affiliate', resource_id: data.id, metadata: {}, severity: 'info' });
    return NextResponse.json({ affiliate: data });
  }

  // ── delete_affiliate ──────────────────────────────────────────────────────────
  if (action === 'delete_affiliate') {
    const { error } = await client.from('affiliates').delete().eq('id', body.id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // ── add_conversion ────────────────────────────────────────────────────────────
  if (action === 'add_conversion') {
    const { data: affiliate } = await client.from('affiliates').select('commission_pct').eq('id', body.affiliate_id).single();
    if (!affiliate) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    const { data: conv, error: convErr } = await client.from('affiliate_conversions').insert({
      affiliate_id:     body.affiliate_id,
      referred_user_id: body.referred_user_id ?? null,
      event_type:       body.event_type ?? 'signup',
      subscription_id:  body.subscription_id ?? null,
      amount_pence:     body.amount_pence ?? null,
      notes:            body.notes ?? null,
    }).select().single();
    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 400 });

    // Auto-create commission if amount provided
    let commission = null;
    if (body.amount_pence) {
      const commAmt = Math.round((body.amount_pence as number) * (affiliate.commission_pct / 100));
      const { data: comm } = await client.from('affiliate_commissions').insert({
        affiliate_id:  body.affiliate_id,
        conversion_id: conv.id,
        amount_pence:  commAmt,
        description:   `${affiliate.commission_pct}% of ${body.event_type ?? 'conversion'}`,
      }).select().single();
      commission = comm;
    }

    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'affiliate.conversion', resource_type: 'affiliate_conversion', resource_id: conv.id, metadata: { affiliate_id: body.affiliate_id }, severity: 'info' });
    return NextResponse.json({ conversion: conv, commission });
  }

  // ── approve_commission ────────────────────────────────────────────────────────
  if (action === 'approve_commission') {
    const { data, error } = await client.from('affiliate_commissions')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', body.id as string).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ commission: data });
  }

  // ── reject_commission ─────────────────────────────────────────────────────────
  if (action === 'reject_commission') {
    const { data, error } = await client.from('affiliate_commissions')
      .update({ status: 'rejected' })
      .eq('id', body.id as string).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ commission: data });
  }

  // ── create_payout ─────────────────────────────────────────────────────────────
  if (action === 'create_payout') {
    // Gather approved commissions for this affiliate
    const { data: approved } = await client
      .from('affiliate_commissions')
      .select('id, amount_pence')
      .eq('affiliate_id', body.affiliate_id as string)
      .eq('status', 'approved')
      .is('payout_id', null);

    if (!approved || approved.length === 0) return NextResponse.json({ error: 'No approved commissions to pay out' }, { status: 400 });

    const totalAmt = approved.reduce((s: number, c: { amount_pence: number }) => s + c.amount_pence, 0);

    const { data: payout, error: payoutErr } = await client.from('affiliate_payouts').insert({
      affiliate_id:     body.affiliate_id,
      amount_pence:     totalAmt,
      commission_count: approved.length,
      payment_method:   body.payment_method ?? 'bank_transfer',
      notes:            body.notes ?? null,
    }).select().single();
    if (payoutErr) return NextResponse.json({ error: payoutErr.message }, { status: 400 });

    // Link commissions to payout
    await client.from('affiliate_commissions')
      .update({ payout_id: payout.id, status: 'paid' })
      .in('id', approved.map((c: { id: string }) => c.id));

    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'affiliate.payout_created', resource_type: 'affiliate_payout', resource_id: payout.id, metadata: { amount_pence: totalAmt, count: approved.length }, severity: 'info' });
    return NextResponse.json({ payout });
  }

  // ── mark_payout_paid ──────────────────────────────────────────────────────────
  if (action === 'mark_payout_paid') {
    const { data, error } = await client.from('affiliate_payouts')
      .update({ status: 'paid', payment_ref: body.payment_ref ?? null, paid_at: new Date().toISOString() })
      .eq('id', body.id as string).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ payout: data });
  }

  // ── add_manual_commission ─────────────────────────────────────────────────────
  if (action === 'add_manual_commission') {
    const { data, error } = await client.from('affiliate_commissions').insert({
      affiliate_id: body.affiliate_id,
      amount_pence: body.amount_pence,
      description:  body.description ?? 'Manual commission',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ commission: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
