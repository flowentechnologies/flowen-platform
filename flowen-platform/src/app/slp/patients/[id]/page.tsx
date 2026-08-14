import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient as adminClient } from '@supabase/supabase-js';
import { assertSlp } from '@/lib/slp/guard';
import PatientClient from './PatientClient';
import type { Session, TreatmentPlan, SessionNote } from './PatientClient';

export const metadata: Metadata = { title: 'Patient Detail — Flowen SLT Portal' };

function db() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function fetchPatientData(slpId: string, patientId: string) {
  const supabase = db();

  // Verify this patient is assigned to this SLT
  const { data: assignment } = await supabase
    .from('slp_assignments')
    .select('id')
    .eq('slp_user_id', slpId)
    .eq('patient_user_id', patientId)
    .single();

  if (!assignment) return null;

  const [profileRes, sessionsRes, planRes, notesRes, progRes] = await Promise.all([
    supabase.from('profiles').select('display_name, email, hcpc_number').eq('id', patientId).single(),
    supabase.from('practice_sessions')
      .select('id, created_at, duration_seconds, total_blocks_detected, total_repetitions_detected, total_prolongations_detected, average_latency_ms, stage_id')
      .eq('user_id', patientId)
      .order('created_at', { ascending: false })
      .limit(90),
    supabase.from('treatment_plans')
      .select('id, phase, sessions_per_week, minutes_per_session, goals, prescribed_stages, active')
      .eq('patient_user_id', patientId)
      .eq('slp_user_id', slpId)
      .eq('active', true)
      .single(),
    supabase.from('slp_session_notes')
      .select('id, session_id, note, created_at')
      .eq('slp_user_id', slpId)
      .order('created_at', { ascending: false }),
    supabase.from('user_programme').select('current_week, started_at').eq('user_id', patientId).single(),
  ]);

  return {
    profile:   profileRes.data,
    sessions:  (sessionsRes.data ?? []) as Session[],
    plan:      (planRes.data ?? null) as TreatmentPlan | null,
    notes:     (notesRes.data ?? []) as SessionNote[],
    programme: progRes.data,
  };
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-xl font-extrabold text-white tabular-nums">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const slp  = await assertSlp();
  const data = await fetchPatientData(slp.id, patientId);

  if (!data) notFound();

  const { profile, sessions, plan, notes, programme } = data;

  // Metrics
  const now    = new Date();
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sessions30d = sessions.filter(s => s.created_at >= days30);
  const avgBlocks   = sessions30d.length
    ? Math.round(sessions30d.reduce((s, x) => s + x.total_blocks_detected, 0) / sessions30d.length)
    : 0;
  const avgDuration = sessions30d.length
    ? Math.round(sessions30d.reduce((s, x) => s + x.duration_seconds, 0) / sessions30d.length / 60)
    : 0;
  const lastSession = sessions[0]?.created_at ?? null;
  const daysSince   = lastSession
    ? Math.floor((now.getTime() - new Date(lastSession).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const name = profile?.display_name || profile?.email || 'Patient';

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
        <Link href="/slp/caseload" className="hover:text-slate-300 transition-colors">Caseload</Link>
        <span>/</span>
        <span className="text-slate-400 truncate">{name}</span>
      </nav>

      {/* Patient header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 text-lg font-extrabold shrink-0">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{name}</h1>
            <p className="text-sm text-slate-400">{profile?.email}</p>
            {programme && (
              <p className="text-xs text-slate-500 mt-0.5">Week {programme.current_week} of programme</p>
            )}
          </div>
        </div>
        {plan && (
          <span className="inline-flex self-start px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold capitalize">
            {plan.phase}
          </span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Metric label="Sessions (30d)"  value={sessions30d.length} />
        <Metric label="Avg blocks / session" value={avgBlocks} sub="30-day average" />
        <Metric label="Avg session length"   value={`${avgDuration}m`} sub="30-day average" />
        <Metric
          label="Last session"
          value={daysSince === null ? 'None' : daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince}d ago`}
          sub={daysSince !== null && daysSince >= 5 ? '⚠ Inactive' : undefined}
        />
      </div>

      {/* Client section: chart + plan + sessions + notes */}
      <PatientClient
        patientId={patientId}
        slpId={slp.id}
        sessions={sessions}
        plan={plan}
        notes={notes}
      />
    </div>
  );
}
