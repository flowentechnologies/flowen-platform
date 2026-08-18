import { assertAdmin } from '@/lib/admin/guard';
import ValuationClient from './ValuationClient';
import type { ValuationConfig, ValuationSnapshot, LiveKpis, RoadmapStatus } from '@/app/api/admin/valuation/route';
import { adminDb } from '@/lib/supabase/admin';

export default async function ValuationPage() {
  await assertAdmin();

  const db = adminDb();

  const [configRes, snapshotsRes, profilesRes, subscriptionsRes, waitlistRes, milestonesRes] = await Promise.all([
    db.from('valuation_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('valuation_snapshots').select('*').order('created_at', { ascending: false }).limit(20),
    db.from('profiles').select('id, tier'),
    db.from('subscriptions').select('amount_pence, status, billing_period').eq('status', 'active'),
    db.from('waitlist').select('id', { count: 'exact', head: true }),
    db.from('roadmap_milestones').select('id, phase, title, status, category'),
  ]);

  // Compute live KPIs server-side
  const profiles    = (profilesRes.data ?? []) as Array<{ id: string; tier: string | null }>;
  const subs        = (subscriptionsRes.data ?? []) as Array<{ amount_pence: number | null; status: string; billing_period: string | null }>;
  const totalUsers  = profiles.length;
  const foundingCount = profiles.filter(p => p.tier === 'founding').length;

  let mrrPence = 0;
  for (const s of subs) {
    const amt = s.amount_pence ?? 0;
    mrrPence += s.billing_period === 'annual' ? Math.round(amt / 12) : amt;
  }

  const waitlistTotal = ((waitlistRes as { count: number | null }).count ?? 0);

  const kpis: LiveKpis = { mrrPence, totalUsers, waitlistTotal, foundingCount };

  const config:     ValuationConfig | null    = configRes.data     ?? null;
  const snapshots:  ValuationSnapshot[]        = snapshotsRes.data  ?? [];
  const milestones: RoadmapStatus[]            = (milestonesRes.data ?? []) as RoadmapStatus[];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Live Valuation</h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xl">
            Multi-method consensus valuation with milestone unlock gates — investor-ready pre-money range computed in real time
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            7 METHODS
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
            LIVE KPIs
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            CONFIDENTIAL
          </span>
        </div>
      </div>

      <ValuationClient
        initialConfig={config}
        initialSnapshots={snapshots}
        initialKpis={kpis}
        initialMilestones={milestones}
      />
    </div>
  );
}
