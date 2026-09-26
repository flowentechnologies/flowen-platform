import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { SubProcessorsClient } from './SubProcessorsClient';

export const dynamic = 'force-dynamic';

export interface SubProcessorRow {
  id: string;
  name: string;
  purpose: string;
  data_categories: string;
  location: string;
  safeguard: string;
  active: boolean;
  added_at: string;
  updated_at: string;
}

export default async function SubProcessorsPage() {
  await assertAdmin();

  const { data } = await adminDb()
    .from('sub_processors')
    .select('*')
    .order('active', { ascending: false })
    .order('name');

  const items = (data ?? []) as SubProcessorRow[];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Sub-processors</h1>
          <p className="text-slate-400 text-sm mt-1">
            The real register shown on <span className="font-mono">/dpa</span> — add a vendor here and it appears there immediately, no deploy needed.
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
          {items.filter(i => i.active).length} ACTIVE
        </span>
      </div>

      <SubProcessorsClient initialItems={items} />
    </div>
  );
}
