import { assertAdmin } from '@/lib/admin/guard';
import { EvidenceClient } from './EvidenceClient';
import type { EvidenceData, ComplianceStatus } from '@/app/api/admin/evidence/route';
import { adminDb as db } from '@/lib/supabase/admin';

function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01' || Boolean(error.message?.includes('does not exist'));
}

type SessionRow = {
  user_id: string;
  duration_seconds: number;
  total_blocks_detected: number;
  created_at: string;
};

function computeAvgBlocksPerMin(sessions: SessionRow[]): number | null {
  const valid = sessions.filter(s => s.duration_seconds >= 10);
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, s) => {
    return sum + s.total_blocks_detected / (s.duration_seconds / 60);
  }, 0);
  return total / valid.length;
}

function computeImprovingUsersPct(sessions: SessionRow[]): number | null {
  const byUser = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const arr = byUser.get(s.user_id) ?? [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  }

  let totalWithData = 0;
  let improving = 0;

  for (const [, userSessions] of byUser) {
    const sorted = [...userSessions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    if (sorted.length < 6) continue;

    totalWithData++;

    const first3 = sorted.slice(0, 3).filter(s => s.duration_seconds >= 10);
    const last3  = sorted.slice(-3).filter(s => s.duration_seconds >= 10);

    if (first3.length === 0 || last3.length === 0) continue;

    const avgFirst = first3.reduce((sum, s) => sum + s.total_blocks_detected / (s.duration_seconds / 60), 0) / first3.length;
    const avgLast  = last3.reduce((sum, s) => sum + s.total_blocks_detected / (s.duration_seconds / 60), 0) / last3.length;

    if (avgFirst > 0 && avgLast < avgFirst * 0.85) {
      improving++;
    }
  }

  if (totalWithData === 0) return null;
  return (improving / totalWithData) * 100;
}

export default async function EvidencePage() {
  await assertAdmin();

  const supabase = db();
  const now = new Date();
  const cutoff30d = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const cutoff90d = new Date(now.getTime() - 90 * 86400_000).toISOString();

  const [
    hazardRes,
    complianceRes,
    sessionsAllRes,
    sessions30dRes,
    sessions90dRes,
    totalUsersRes,
    onboardedRes,
    slpRes,
    icbRes,
  ] = await Promise.all([
    supabase.from('hazard_log').select('status,risk_level,residual_risk_level'),
    supabase.from('compliance_items').select('framework,status'),
    supabase.from('practice_sessions').select('*', { count: 'exact', head: true }),
    supabase.from('practice_sessions')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', cutoff30d),
    supabase.from('practice_sessions')
      .select('user_id,duration_seconds,total_blocks_detected,created_at')
      .gte('created_at', cutoff90d),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
    supabase.from('nhs_slp_signups').select('*', { count: 'exact', head: true }),
    supabase.from('nhs_icb_contacts').select('*', { count: 'exact', head: true }),
  ]);

  // Hazard log
  const hazardData = { total: 0, open: 0, mitigated: 0, high_or_critical_open: 0 };
  if (!hazardRes.error || isMissingTable(hazardRes.error ?? {})) {
    const rows = (hazardRes.data ?? []) as { status: string; risk_level: string; residual_risk_level: string }[];
    hazardData.total     = rows.length;
    hazardData.open      = rows.filter(r => r.status === 'open').length;
    hazardData.mitigated = rows.filter(r => r.status === 'mitigated').length;
    hazardData.high_or_critical_open = rows.filter(
      r => r.status === 'open' && (r.residual_risk_level === 'high' || r.residual_risk_level === 'critical'),
    ).length;
  }

  // Compliance
  const compliance: ComplianceStatus[] = [];
  if (!complianceRes.error || isMissingTable(complianceRes.error ?? {})) {
    const rows = (complianceRes.data ?? []) as { framework: string; status: string }[];
    const byFramework = new Map<string, { framework: string; status: string }[]>();
    for (const row of rows) {
      const fw = row.framework.toUpperCase();
      const arr = byFramework.get(fw) ?? [];
      arr.push(row);
      byFramework.set(fw, arr);
    }
    const knownFrameworks = ['DCB0129', 'DTAC', 'DSPT', 'MHRA', 'WCAG'];
    for (const fw of knownFrameworks) {
      if (!byFramework.has(fw)) byFramework.set(fw, []);
    }
    for (const [framework, items] of byFramework) {
      const complete       = items.filter(i => i.status === 'complete').length;
      const in_progress    = items.filter(i => i.status === 'in_progress').length;
      const not_started    = items.filter(i => i.status === 'not_started').length;
      const not_applicable = items.filter(i => i.status === 'not_applicable').length;
      const total = items.length;
      const countable = total - not_applicable;
      const pct_complete = countable > 0 ? Math.round((complete / countable) * 100) : 0;
      compliance.push({ framework, complete, in_progress, not_started, not_applicable, total, pct_complete });
    }
    const order = ['DCB0129', 'DTAC', 'DSPT', 'MHRA', 'WCAG'];
    compliance.sort((a, b) => {
      const ia = order.indexOf(a.framework);
      const ib = order.indexOf(b.framework);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.framework.localeCompare(b.framework);
    });
  }

  // Sessions
  const sessions90d = (sessions90dRes.data ?? []) as SessionRow[];
  const uniqueUsers = new Set(sessions90d.map(s => s.user_id)).size;
  const avgBlocksPerMin = computeAvgBlocksPerMin(sessions90d);
  const improvingUsersPct = computeImprovingUsersPct(sessions90d);
  const validDuration = sessions90d.filter(s => s.duration_seconds >= 10);
  const avgSessionDuration = validDuration.length > 0
    ? validDuration.reduce((sum, s) => sum + s.duration_seconds, 0) / validDuration.length
    : null;

  const evidenceData: EvidenceData = {
    hazard_log: hazardData,
    compliance,
    sessions_total: sessionsAllRes.count ?? 0,
    sessions_last_30d: sessions30dRes.count ?? 0,
    unique_users_with_sessions: uniqueUsers,
    avg_blocks_per_min: avgBlocksPerMin,
    improving_users_pct: improvingUsersPct,
    avg_session_duration_seconds: avgSessionDuration,
    total_users: totalUsersRes.count ?? 0,
    onboarded_users: onboardedRes.count ?? 0,
    slp_signups: slpRes.count ?? 0,
    icb_pipeline: icbRes.count ?? 0,
    generated_at: now.toISOString(),
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">NHS Clinical Evidence Pack</h1>
          <p className="text-slate-400 text-sm mt-1">
            Clinical safety · effectiveness · technical assurance · procurement readiness
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          CONFIDENTIAL
        </span>
      </div>
      <EvidenceClient data={evidenceData} />
    </div>
  );
}
