import { assertAdmin } from '@/lib/admin/guard';
import { HazardLogClient } from './HazardLogClient';
import type { HazardEntry } from '@/app/api/admin/hazard-log/route';
import { adminDb } from '@/lib/supabase/admin';

export default async function HazardLogPage() {
  await assertAdmin();

  let entries: HazardEntry[] = [];

  try {
    const supabase = adminDb();
    const { data, error } = await supabase
      .from('hazard_log')
      .select('*')
      .order('hazard_ref');

    if (!error && data) {
      entries = data as HazardEntry[];
    }
    // Graceful empty on error (e.g. table not yet created)
  } catch {
    // table missing or network error — render empty state
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">DCB0129 Hazard Log</h1>
          <p className="text-slate-400 text-sm mt-1">
            Clinical Safety Standard — NHS mandatory deliverable
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          NHS PROCUREMENT GATE
        </span>
      </div>

      <aside className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-slate-600 dark:text-slate-300">
        <h2 className="font-semibold">Working hazard log - clinical approval pending</h2>
        <p className="mt-2">The recorded scores, reviewer names and mitigation statuses are not evidence of qualified CSO acceptance. H005 and H008 remain open. Existing mitigation text includes unverified controls; the 30 September 2026 evidence actions are in the risk management plan. Do not use this log as an approved NHS release record.</p>
        <a className="mt-2 inline-block underline text-amber-700 dark:text-amber-400" href="/admin/policies#POL-006">Control verification and CSO approval actions</a>
      </aside>

      <HazardLogClient initialEntries={entries} />
    </div>
  );
}
