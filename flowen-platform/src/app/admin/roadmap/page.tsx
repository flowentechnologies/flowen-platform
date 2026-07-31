import { assertAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { RoadmapClient } from './RoadmapClient';
import { SEED_DATA } from './seed-data';
import type { RoadmapMilestone } from '@/app/api/admin/roadmap/route';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const PHASE_ORDER: Record<string, number> = { launch: 0, nhs_pilot: 1, scale: 2 };

function sortMilestones(data: RoadmapMilestone[]): RoadmapMilestone[] {
  return data.slice().sort((a, b) => {
    const pa = PHASE_ORDER[a.phase] ?? 99;
    const pb = PHASE_ORDER[b.phase] ?? 99;
    if (pa !== pb) return pa - pb;
    if (!a.target_date && !b.target_date) return 0;
    if (!a.target_date) return 1;
    if (!b.target_date) return -1;
    return a.target_date.localeCompare(b.target_date);
  });
}

async function fetchAndSeed(): Promise<RoadmapMilestone[]> {
  const client = db();

  const { data, error } = await client
    .from('roadmap_milestones')
    .select('*')
    .order('target_date', { ascending: true, nullsFirst: false });

  if (error) return [];

  if ((data ?? []).length === 0) {
    await client.from('roadmap_milestones').insert(SEED_DATA);
    const { data: seeded } = await client
      .from('roadmap_milestones')
      .select('*')
      .order('target_date', { ascending: true, nullsFirst: false });
    return sortMilestones((seeded ?? []) as RoadmapMilestone[]);
  }

  return sortMilestones((data ?? []) as RoadmapMilestone[]);
}

export default async function RoadmapPage() {
  await assertAdmin();

  const milestones = await fetchAndSeed();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Product Roadmap</h1>
        <p className="text-sm text-slate-500 font-mono mt-1">
          Phase progress tracker — Launch · NHS Pilot · Scale
        </p>
      </div>
      <RoadmapClient initialMilestones={milestones} />
    </div>
  );
}
