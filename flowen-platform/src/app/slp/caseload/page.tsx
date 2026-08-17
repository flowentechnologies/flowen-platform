import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createClient as adminClient } from '@supabase/supabase-js';
import { assertSlp } from '@/lib/slp/guard';

export const metadata: Metadata = { title: 'My Caseload — Flowen SLT Portal' };

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface CaseloadPatient {
  patient_user_id: string;
  display_name: string;
  email: string;
  current_week: number | null;
  sessions_30d: number;
  total_sessions: number;
  last_session_at: string | null;
  plan_phase: string | null;
  sessions_per_week: number | null;
  plan_active: boolean;
  days_since_last: number | null;
  flag: 'ok' | 'inactive' | 'never_started' | 'no_plan';
}

// Cache per-SLT, revalidated on enrol/discharge via revalidateTag('slp-caseload').
// auth (assertSlp / cookies()) runs in the page component above — never inside here.
const fetchCaseload = unstable_cache(
  async (slpId: string): Promise<CaseloadPatient[]> => {
  const supabase = db();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Assigned patients
  const { data: assignments } = await supabase
    .from('slp_assignments')
    .select('patient_user_id, notes')
    .eq('slp_user_id', slpId);

  if (!assignments?.length) return [];

  const patientIds = assignments.map(a => a.patient_user_id);

  // 2. Parallel fetch
  const [profilesRes, sessionsRes, plansRes, programmesRes] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email').in('id', patientIds),
    supabase.from('practice_sessions').select('user_id, created_at').in('user_id', patientIds).order('created_at', { ascending: false }),
    supabase.from('treatment_plans').select('patient_user_id, phase, sessions_per_week, active').in('patient_user_id', patientIds).eq('active', true),
    supabase.from('user_programme').select('user_id, current_week').in('user_id', patientIds),
  ]);

  const profiles   = profilesRes.data   ?? [];
  const sessions   = sessionsRes.data   ?? [];
  const plans      = plansRes.data      ?? [];
  const programmes = programmesRes.data ?? [];

  return assignments.map(a => {
    const pid     = a.patient_user_id;
    const profile = profiles.find(p => p.id === pid);
    const plan    = plans.find(p => p.patient_user_id === pid);
    const prog    = programmes.find(p => p.user_id === pid);

    const patientSessions = sessions.filter(s => s.user_id === pid);
    const lastSession     = patientSessions[0]?.created_at ?? null;
    const sessions30d     = patientSessions.filter(s => s.created_at >= thirtyDaysAgo).length;

    let daysSince: number | null = null;
    if (lastSession) {
      daysSince = Math.floor((now.getTime() - new Date(lastSession).getTime()) / (1000 * 60 * 60 * 24));
    }

    let flag: CaseloadPatient['flag'] = 'ok';
    if (!plan) {
      flag = 'no_plan';
    } else if (patientSessions.length === 0) {
      flag = 'never_started';
    } else if (daysSince !== null && daysSince >= 5) {
      flag = 'inactive';
    }

    return {
      patient_user_id:   pid,
      display_name:      profile?.display_name ?? '—',
      email:             profile?.email ?? '—',
      current_week:      prog?.current_week ?? null,
      sessions_30d:      sessions30d,
      total_sessions:    patientSessions.length,
      last_session_at:   lastSession,
      plan_phase:        plan?.phase ?? null,
      sessions_per_week: plan?.sessions_per_week ?? null,
      plan_active:       plan?.active ?? false,
      days_since_last:   daysSince,
      flag,
    };
  });
  },
  ['slp-caseload'],
  { tags: ['slp-caseload'], revalidate: 60 },
);

function FlagBadge({ flag }: { flag: CaseloadPatient['flag'] }) {
  if (flag === 'ok') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
      Active
    </span>
  );
  if (flag === 'inactive') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      Inactive
    </span>
  );
  if (flag === 'never_started') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/60 border border-slate-600 text-slate-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
      Not started
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
      No plan
    </span>
  );
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

export default async function CaseloadPage() {
  const slp      = await assertSlp();
  const patients = await fetchCaseload(slp.id);

  const flagOrder: Record<CaseloadPatient['flag'], number> = {
    inactive: 0, no_plan: 1, never_started: 2, ok: 3,
  };
  const sorted = [...patients].sort((a, b) => flagOrder[a.flag] - flagOrder[b.flag]);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">My Caseload</h1>
          <p className="text-sm text-slate-400 mt-1">
            {patients.length} patient{patients.length !== 1 ? 's' : ''} assigned
            {patients.filter(p => p.flag === 'inactive').length > 0 && (
              <span className="text-amber-400 ml-2">
                · {patients.filter(p => p.flag === 'inactive').length} inactive
              </span>
            )}
          </p>
        </div>
        <Link
          href="/slp/patients/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Enrol Patient
        </Link>
      </div>

      {/* Summary strip */}
      {patients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total patients',   value: patients.length },
            { label: 'Active (7d)',       value: patients.filter(p => p.days_since_last !== null && p.days_since_last < 7).length },
            { label: 'Inactive (5d+)',    value: patients.filter(p => p.flag === 'inactive').length },
            { label: 'Sessions this month', value: patients.reduce((s, p) => s + p.sessions_30d, 0) },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-2xl font-extrabold text-white tabular-nums">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Patient list */}
      {sorted.length === 0 ? (
        <div className="text-center py-20 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 mb-4">No patients assigned to your caseload yet.</p>
          <Link
            href="/slp/patients/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
          >
            Enrol your first patient
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(patient => (
            <Link
              key={patient.patient_user_id}
              href={`/slp/patients/${patient.patient_user_id}`}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-2xl p-5 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold shrink-0">
                  {(patient.display_name !== '—' ? patient.display_name : patient.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                    {patient.display_name !== '—' ? patient.display_name : patient.email}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{patient.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0">
                <FlagBadge flag={patient.flag} />

                {patient.plan_phase && (
                  <div className="text-center">
                    <p className="text-xs font-mono text-slate-300 capitalize">{patient.plan_phase}</p>
                    <p className="text-[10px] text-slate-600">phase</p>
                  </div>
                )}

                {patient.current_week !== null && (
                  <div className="text-center">
                    <p className="text-xs font-mono text-slate-300">Wk {patient.current_week}</p>
                    <p className="text-[10px] text-slate-600">programme</p>
                  </div>
                )}

                <div className="text-center">
                  <p className="text-xs font-mono text-slate-300 tabular-nums">{patient.sessions_30d}</p>
                  <p className="text-[10px] text-slate-600">sessions / 30d</p>
                </div>

                <div className="text-center hidden sm:block">
                  <p className="text-xs text-slate-300">{formatRelative(patient.last_session_at)}</p>
                  <p className="text-[10px] text-slate-600">last session</p>
                </div>

                <svg className="text-slate-600 group-hover:text-emerald-400 transition-colors hidden sm:block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
