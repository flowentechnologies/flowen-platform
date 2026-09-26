import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { CompanyRecordsClient } from './CompanyRecordsClient';

export const dynamic = 'force-dynamic';

export interface CompanyRecordRow {
  id: string;
  entity: string;
  record_type: string;
  value: string;
  issued_by: string | null;
  issued_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default async function CompanyRecordsPage() {
  await assertAdmin();

  const { data } = await adminDb()
    .from('company_records')
    .select('*')
    .order('entity')
    .order('record_type');

  const items = (data ?? []) as CompanyRecordRow[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Company Records</h1>
          <p className="text-slate-400 text-sm mt-1">Corporation Tax UTRs, VAT numbers, and other identifiers — one register per Flowen entity.</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
          {items.length} RECORD{items.length === 1 ? '' : 'S'}
        </span>
      </div>

      <CompanyRecordsClient initialItems={items} />
    </div>
  );
}
