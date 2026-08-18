import { assertAdmin } from '@/lib/admin/guard';
import { GrantsClient } from './GrantsClient';
import type { Grant } from '@/app/api/admin/grants/route';
import { adminDb as db } from '@/lib/supabase/admin';

async function fetchGrants(): Promise<Grant[]> {
  const client = db();
  const { data, error } = await client
    .from('grants')
    .select('*')
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Grant[];
}

export default async function GrantsPage() {
  await assertAdmin();

  const grants = await fetchGrants();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Grants &amp; Funding</h1>
        <p className="text-sm text-slate-500 font-mono mt-1">Non-dilutive pipeline — Innovate UK, SBRI, NIHR &amp; more</p>
      </div>
      <GrantsClient initialGrants={grants} />
    </div>
  );
}
