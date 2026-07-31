import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import CapTableClient from './CapTableClient';
import type { CapTableEntry } from '@/app/api/admin/cap-table/route';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function CapTablePage() {
  await assertAdmin();

  const db = adminDb();

  const { data, error } = await db
    .from('cap_table_entries')
    .select('*')
    .order('holder_type', { ascending: true })
    .order('created_at', { ascending: true });

  let entries: CapTableEntry[] = data ?? [];

  // Auto-seed if empty and no error
  if (!error && entries.length === 0) {
    const SEED_ENTRIES = [
      {
        holder_name: 'Howard (Founder)',
        holder_type: 'founder',
        instrument: 'ordinary_shares',
        shares: 5_000_000,
        share_class: 'A Ordinary',
        price_per_share_pence: 1,
        amount_pence: 50_000,
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
        vesting_months: 48,
        cliff_months: 12,
        seis_eligible: false,
        eis_eligible: false,
        notes: 'Board-approved EMI option pool. Standard 4-year vest, 1-year cliff applied to all grants.',
      },
      {
        holder_name: 'SEIS Advance Assurance Investor (Placeholder)',
        holder_type: 'investor',
        instrument: 'safe_note',
        amount_pence: 5_000_000,
        valuation_cap_pence: 250_000_000,
        discount_pct: 20.0,
        seis_eligible: true,
        eis_eligible: false,
        notes: 'SAFE note — £50k at £2.5M valuation cap, 20% conversion discount. SEIS advance assurance pending.',
      },
    ];

    const { data: seeded } = await db
      .from('cap_table_entries')
      .insert(SEED_ENTRIES)
      .select();

    if (seeded) {
      entries = seeded as CapTableEntry[];
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Cap Table</h1>
          <p className="text-slate-400 text-sm mt-1">
            Equity Register &amp; Instrument Ledger &middot; SEIS/EIS Tracker &middot; Investor Due Diligence
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/30">
            CONFIDENTIAL
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            SEIS/EIS
          </span>
        </div>
      </div>

      <CapTableClient initialEntries={entries} />
    </div>
  );
}
