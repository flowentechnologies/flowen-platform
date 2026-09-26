import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

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

  // 'seed' removed (26 Sep 2026): this is exactly how the table ended up with
  // fictional example data (5,000,000 "A Ordinary" shares issued 2024-01-15,
  // an invented £50k SEIS SAFE note at a £2.5M cap, "SEIS advance assurance
  // received" — none of it true) sitting in the live cap table. There is no
  // legitimate reason to reseed a real company's real cap table with
  // placeholder rows, so the capability is gone, not just its data corrected.

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
