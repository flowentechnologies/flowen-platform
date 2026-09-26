import Link from 'next/link';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { SeisEisClient } from './SeisEisClient';

export const dynamic = 'force-dynamic';

export interface SeisEisStatusRow {
  id: string;
  advance_assurance_status: string;
  advance_assurance_submitted_at: string | null;
  advance_assurance_reference: string | null;
  consolidated_gross_assets_pence: number | null;
  total_fte: number | null;
  first_trading_date: string | null;
  prior_eis_vct_investment: boolean | null;
  prior_eis_vct_notes: string | null;
  seis1_filed: boolean;
  seis1_filed_at: string | null;
  notes: string | null;
  updated_at: string;
}

export default async function SeisEisPage() {
  await assertAdmin();

  const { data } = await adminDb().from('seis_eis_status').select('*').limit(1).maybeSingle();
  const item = data as SeisEisStatusRow | null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">SEIS / EIS</h1>
          <p className="text-slate-400 text-sm mt-1">
            Advance Assurance status for Flowen Group Ltd — see{' '}
            <Link href="/admin/ip-docs/seis-advance-assurance" className="underline hover:text-slate-300">the application letter</Link>,{' '}
            <Link href="/admin/cap-table" className="underline hover:text-slate-300">cap table</Link>.
          </p>
        </div>
      </div>

      <SeisEisClient item={item} />
    </div>
  );
}
