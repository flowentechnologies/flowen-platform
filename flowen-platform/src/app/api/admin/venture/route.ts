import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';

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

  // Fetch investors and config, gracefully handle missing tables
  const [investorsRes, configRes] = await Promise.all([
    client.from('investors').select('*').order('created_at', { ascending: false }),
    client.from('venture_config').select('*').eq('id', 1).maybeSingle(),
  ]);

  const investors: Investor[] = investorsRes.error ? [] : (investorsRes.data ?? []);
  const config: VentureConfig | null = configRes.error ? null : (configRes.data ?? null);

  const data: VentureData = {
    investors,
    config,
    kpis: { totalUsers: 0, newUsersWeek: 0, foundingCount: 0, waitlistTotal: 0, mrrPence: 0, onboardedPct: 0 },
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
    return NextResponse.json({ data });
  }

  // ── update_investor ───────────────────────────────────────────────────────

  if (action === 'update_investor') {
    const { id, action: _a, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await client
      .from('investors')
      .update(fields)
      .eq('id', id as string)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  // ── delete_investor ───────────────────────────────────────────────────────

  if (action === 'delete_investor') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await client.from('investors').delete().eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // ── update_config ─────────────────────────────────────────────────────────

  if (action === 'update_config') {
    const { action: _a, ...fields } = body;
    const payload = { id: 1, updated_at: new Date().toISOString(), ...fields };
    const { data, error } = await client
      .from('venture_config')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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
