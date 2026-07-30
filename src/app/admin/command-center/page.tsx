import { createClient as createServiceClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import SentryTestButton from './SentryTestButton';

function severityClass(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
    case 'SECURITY_ALERT':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'WARNING':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    default:
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AuditRow {
  id: string;
  timestamp: string;
  severity: string;
  category: string;
  action: string;
  actor_id: string;
}

interface ErrorRow {
  id: string;
  source: string;
  message: string;
  created_at: string;
}

interface WaitlistRow {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
}

export default async function CommandCenterPage() {
  await assertAdmin();

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const [
    totalUsersRes,
    activeSubsRes,
    waitlistRes,
    foundingRes,
    onboardedRes,
    recentErrorsRes,
    recentAuditRes,
    recentWaitlistRes,
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'founding'),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
    admin.from('system_error_logs').select('id,source,message,created_at').order('created_at', { ascending: false }).limit(5),
    admin.from('audit_logs').select('id,timestamp,severity,category,action,actor_id').order('timestamp', { ascending: false }).limit(10),
    admin.from('waitlist_signups').select('id,email,source,created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  const totalUsers = totalUsersRes.count ?? 0;
  const activeSubs = activeSubsRes.count ?? 0;
  const waitlistCount = waitlistRes.count ?? 0;
  const foundingCount = foundingRes.count ?? 0;
  const onboardedCount = onboardedRes.count ?? 0;
  const recentErrors = (recentErrorsRes.data ?? []) as ErrorRow[];
  const recentAudit = (recentAuditRes.data ?? []) as AuditRow[];
  const recentWaitlist = (recentWaitlistRes.data ?? []) as WaitlistRow[];

  const FOUNDING_GOAL = 500;
  const foundingPct = Math.min(100, Math.round((foundingCount / FOUNDING_GOAL) * 100));
  const onboardedPct = totalUsers > 0 ? Math.round((onboardedCount / totalUsers) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Command Centre</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time platform overview</p>
        </div>
        <div className="flex items-center gap-3">
          <SentryTestButton />
          <span className="self-start sm:self-auto px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">
            LIVE DATA
          </span>
        </div>
      </div>

      {/* KPI grid row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Total Users</p>
          <p className="text-4xl font-black text-white">{totalUsers.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Active Subscribers</p>
          <p className="text-4xl font-black text-emerald-400">{activeSubs.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Waitlist</p>
          <p className="text-4xl font-black text-sky-400">{waitlistCount.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Founding Members</p>
          <p className="text-4xl font-black text-amber-400">{foundingCount.toLocaleString()}</p>
        </div>
      </div>

      {/* KPI grid row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Onboarded Users</p>
          <p className="text-4xl font-black text-white">{onboardedCount.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">{onboardedPct}% of all users</p>
          <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${onboardedPct}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wide">Founding Slot Progress</p>
            <span className="text-xs font-mono text-amber-400">{foundingCount} / {FOUNDING_GOAL}</span>
          </div>
          <p className="text-4xl font-black text-amber-400">{foundingPct}%</p>
          <p className="text-xs text-slate-500 mt-2">{FOUNDING_GOAL - foundingCount} slots remaining</p>
          <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${foundingPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* OKR Milestones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-lg font-bold text-white">OKR Milestones</h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            TARGETS
          </span>
        </div>
        <div className="space-y-4">
          {[
            {
              label: '500 Founding Members',
              pct: foundingPct,
              current: foundingCount,
              goal: FOUNDING_GOAL,
              color: 'bg-amber-400',
            },
            {
              label: 'NHS Pilot',
              pct: 0,
              current: 0,
              goal: 1,
              color: 'bg-sky-400',
            },
            {
              label: 'App Store Launch',
              pct: 0,
              current: 0,
              goal: 1,
              color: 'bg-emerald-500',
            },
          ].map((okr) => (
            <div key={okr.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-300">{okr.label}</span>
                <span className="text-xs font-mono text-slate-400">
                  {okr.pct > 0 ? `${okr.pct}%` : 'Pending'}
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${okr.color} rounded-full transition-all`}
                  style={{ width: `${okr.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom 3-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Audit Log */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Recent Audit Events</h2>
            <a href="/admin/audit" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              View all
            </a>
          </div>
          {recentAudit.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-500 text-center">No audit events</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {recentAudit.map((log) => (
                <li key={log.id} className="px-6 py-3 flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${severityClass(log.severity)}`}
                  >
                    {log.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{log.action}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {log.category} &bull; {formatDate(log.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: Waitlist + Errors */}
        <div className="space-y-6">
          {/* Recent Waitlist */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">Recent Signups</h2>
            </div>
            {recentWaitlist.length === 0 ? (
              <p className="px-5 py-6 text-xs text-slate-500 text-center">No signups</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {recentWaitlist.map((w) => (
                  <li key={w.id} className="px-5 py-3">
                    <p className="text-xs text-white font-medium truncate">{w.email}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {w.source ?? 'direct'} &bull; {formatDate(w.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent Errors */}
          <div
            className={`bg-slate-900 rounded-2xl overflow-hidden border ${
              recentErrors.length > 0 ? 'border-red-500/30' : 'border-slate-800'
            }`}
          >
            <div
              className={`px-5 py-4 border-b ${
                recentErrors.length > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-slate-800'
              }`}
            >
              <h2 className="text-sm font-bold text-white">
                Recent Errors{' '}
                {recentErrors.length > 0 && (
                  <span className="ml-1 text-red-400">({recentErrors.length})</span>
                )}
              </h2>
            </div>
            {recentErrors.length === 0 ? (
              <p className="px-5 py-6 text-xs text-emerald-400 text-center font-mono">No errors</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {recentErrors.map((err) => (
                  <li key={err.id} className="px-5 py-3">
                    <p className="text-xs text-red-300 font-medium font-mono truncate">{err.source}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{err.message}</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{formatDate(err.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
