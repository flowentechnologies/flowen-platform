import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { ComplianceClient } from './ComplianceClient';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function CompliancePage() {
  await assertAdmin();

  const db = adminDb();

  const { data, error } = await db
    .from('compliance_items')
    .select('*')
    .order('framework')
    .order('item_code');

  // Gracefully handle missing table
  let items: ComplianceItem[] = [];
  if (!error && data) {
    items = data as ComplianceItem[];
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">NHS Compliance</h1>
          <p className="text-slate-400 text-sm mt-1">
            Clinical safety · data security · regulatory readiness · accessibility
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/30">
          NHS PROCUREMENT GATE
        </span>
      </div>

      <ComplianceClient initialItems={items} />
    </div>
  );
}

// Re-export type so the client can import it
export type ComplianceItem = {
  id: string;
  framework: string;
  item_code: string;
  status: string;
  notes: string | null;
  evidence_url: string | null;
  updated_at: string;
};
