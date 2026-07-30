import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { WorkflowsClient } from './WorkflowsClient';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function WorkflowsPage() {
  await assertAdmin();

  const db = adminDb();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [definitionsRes, runsRes] = await Promise.all([
    db.from('workflow_definitions').select('*').order('created_at', { ascending: false }),
    db.from('workflow_runs').select('*').order('started_at', { ascending: false }),
  ]);

  const definitions = definitionsRes.data ?? [];
  const allRuns = runsRes.data ?? [];

  // Attach last 5 runs to each workflow
  const runsByWorkflow = allRuns.reduce<Record<string, typeof allRuns>>((acc, run) => {
    if (!acc[run.workflow_id]) acc[run.workflow_id] = [];
    if (acc[run.workflow_id].length < 5) acc[run.workflow_id].push(run);
    return acc;
  }, {});

  const workflows = definitions.map(wf => ({
    ...wf,
    recent_runs: runsByWorkflow[wf.id] ?? [],
  }));

  // KPIs
  const activeCount = definitions.filter(wf => wf.status === 'active').length;

  const runsToday = allRuns.filter(run =>
    new Date(run.started_at) >= todayStart
  ).length;

  const failedLast7d = allRuns.filter(run =>
    run.status === 'failed' && run.started_at >= sevenDaysAgo
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Workflows</h1>
          <p className="text-slate-400 text-sm mt-1">Automated trigger-action playbooks · enable, pause, and manually trigger</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          AUTOMATION
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Active Workflows</p>
          <p className="text-3xl font-black text-white">{activeCount}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{definitions.length} total defined</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Runs Today</p>
          <p className="text-3xl font-black text-white">{runsToday}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{allRuns.length} all-time</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Failed (7d)</p>
          <p className={`text-3xl font-black ${failedLast7d > 0 ? 'text-red-400' : 'text-white'}`}>{failedLast7d}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">last 7 days</p>
        </div>
      </div>

      {/* Main panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <WorkflowsClient initialWorkflows={workflows} />
      </div>
    </div>
  );
}
