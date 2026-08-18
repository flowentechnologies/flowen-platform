import { assertAdmin } from '@/lib/admin/guard';
import CapTableClient from './CapTableClient';
import type { CapTableEntry } from '@/app/api/admin/cap-table/route';
import { adminDb } from '@/lib/supabase/admin';

export default async function CapTablePage() {
  await assertAdmin();

  const db = adminDb();

  const { data, error } = await db
    .from('cap_table_entries')
    .select('*')
    .order('holder_type', { ascending: true })
    .order('created_at', { ascending: true });

  const entries: CapTableEntry[] = data ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Cap Table</h1>
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
