import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/admin/audit';

// ── Exported types ─────────────────────────────────────────────────────────────

export type HolderType = 'founder' | 'investor' | 'employee' | 'advisor' | 'pool';
export type Instrument =
  | 'ordinary_shares'
  | 'preference_shares'
  | 'safe_note'
  | 'convertible_loan'
  | 'emi_option'
  | 'unapproved_option'
  | 'warrant';

export interface CapTableEntry {
  id: string;
  holder_name: string;
  holder_type: HolderType;
  instrument: Instrument;
  shares: number | null;
  share_class: string | null;
  price_per_share_pence: number | null;
  amount_pence: number | null;
  valuation_cap_pence: number | null;
  discount_pct: number | null;
  interest_rate_pct: number | null;
  vesting_start: string | null;
  vesting_months: number | null;
  cliff_months: number | null;
  seis_eligible: boolean;
  eis_eligible: boolean;
  certificate_ref: string | null;
  issued_at: string | null;
  notes: string | null;
  created_at: string;
}

// ── Column allowlist ──────────────────────────────────────────────────────────

const CAP_TABLE_COLUMNS = new Set([
  'holder_name', 'holder_type', 'instrument', 'shares', 'share_class',
  'price_per_share_pence', 'amount_pence', 'valuation_cap_pence',
  'discount_pct', 'interest_rate_pct', 'vesting_start', 'vesting_months',
  'cliff_months', 'seis_eligible', 'eis_eligible', 'certificate_ref',
  'issued_at', 'notes',
]);

function pick(obj: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.has(k)));
}

// ── DB client ─────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_ENTRIES = [
  {
    holder_name: 'Howard (Founder)',
    holder_type: 'founder',
    instrument: 'ordinary_shares',
    shares: 5_000_000,
    share_class: 'A Ordinary',
    price_per_share_pence: 1,
    amount_pence: 50_000,
    valuation_cap_pence: null,
    discount_pct: null,
    interest_rate_pct: null,
    vesting_start: null,
    vesting_months: null,
    cliff_months: null,
    seis_eligible: true,
    eis_eligible: false,
    certificate_ref: 'SC-001',
    issued_at: '2024-01-15',
    notes: 'Founding shares. SEIS advance assurance received.',
  },
  {
    holder_name: 'Co-Founder',
    holder_type: 'founder',
    instrument: 'ordinary_shares',
    shares: 1_500_000,
    share_class: 'A Ordinary',
    price_per_share_pence: 1,
    amount_pence: 15_000,
    valuation_cap_pence: null,
    discount_pct: null,
    interest_rate_pct: null,
    vesting_start: '2024-01-15',
    vesting_months: 48,
    cliff_months: 12,
    seis_eligible: false,
    eis_eligible: false,
    certificate_ref: 'SC-002',
    issued_at: '2024-01-15',
    notes: '4-year vest, 1-year cliff.',
  },
  {
    holder_name: 'EMI Option Pool (Unissued)',
    holder_type: 'pool',
    instrument: 'emi_option',
    shares: 500_000,
    share_class: null,
    price_per_share_pence: null,
    amount_pence: null,
    valuation_cap_pence: null,
    discount_pct: null,
    interest_rate_pct: null,
    vesting_start: null,
    vesting_months: 48,
    cliff_months: 12,
    seis_eligible: false,
    eis_eligible: false,
    certificate_ref: null,
    issued_at: null,
    notes: 'Board-approved EMI option pool. Standard 4-year vest, 1-year cliff applied to all grants.',
  },
  {
    holder_name: 'SEIS Advance Assurance Investor (Placeholder)',
    holder_type: 'investor',
    instrument: 'safe_note',
    shares: null,
    share_class: null,
    price_per_share_pence: null,
    amount_pence: 5_000_000,
    valuation_cap_pence: 250_000_000,
    discount_pct: 20.00,
    interest_rate_pct: null,
    vesting_start: null,
    vesting_months: null,
    cliff_months: null,
    seis_eligible: true,
    eis_eligible: false,
    certificate_ref: null,
    issued_at: null,
    notes: 'SAFE note — £50k at £2.5M valuation cap, 20% conversion discount. SEIS advance assurance pending.',
  },
];

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();

  const { data, error } = await supabase
    .from('cap_table_entries')
    .select('*')
    .order('holder_type', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    // Graceful empty if table missing
    return NextResponse.json({ entries: [] });
  }

  const entries: CapTableEntry[] = data ?? [];
  return NextResponse.json({ entries });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action } = body;
  const supabase = db();

  // ── add ──────────────────────────────────────────────────────────────────────
  if (action === 'add') {
    const { action: _a, ...rest } = body;
    const fields = pick(rest, CAP_TABLE_COLUMNS);
    const { data, error } = await supabase
      .from('cap_table_entries')
      .insert(fields)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'cap_table.add', resource_type: 'cap_table_entry', resource_id: data.id, metadata: { holder_name: data.holder_name, instrument: data.instrument, shares: data.shares }, severity: 'info' });
    return NextResponse.json({ entry: data });
  }

  // ── update ───────────────────────────────────────────────────────────────────
  if (action === 'update') {
    const { action: _a, id, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = pick(rest, CAP_TABLE_COLUMNS);
    const { data, error } = await supabase
      .from('cap_table_entries')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'cap_table.update', resource_type: 'cap_table_entry', resource_id: data.id, severity: 'info' });
    return NextResponse.json({ entry: data });
  }

  // ── delete ───────────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('cap_table_entries').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'cap_table.delete', resource_type: 'cap_table_entry', resource_id: id as string, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  // ── seed ─────────────────────────────────────────────────────────────────────
  if (action === 'seed') {
    const { count: countData } = await supabase
      .from('cap_table_entries')
      .select('*', { count: 'exact', head: true });
    const count = countData ?? 0;
    if (count >= 3) {
      return NextResponse.json({ skipped: true, reason: 'already seeded' });
    }
    const { data, error } = await supabase
      .from('cap_table_entries')
      .insert(SEED_ENTRIES)
      .select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ seeded: data?.length ?? 0 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
