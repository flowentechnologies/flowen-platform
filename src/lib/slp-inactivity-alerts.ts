import { createClient } from '@supabase/supabase-js';
import { sendSlpInactivityDigest } from '@/lib/email';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// A patient is flagged inactive after this many days without a session
const INACTIVITY_DAYS = 5;

// Don't re-alert the SLT about the same patient within this window
const COOLDOWN_DAYS = 7;

interface InactivePatient {
  patientId:    string;
  patientName:  string;
  patientEmail: string;
  daysSince:    number;
}

export async function sendSlpInactivityAlerts(): Promise<{
  emailsSent:    number;
  patientsAlerted: number;
  skipped:       number;
}> {
  const admin = db();
  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_DAYS * 86400_000).toISOString();

  // 1. All SLT assignments
  const { data: assignments } = await admin
    .from('slp_assignments')
    .select('slp_user_id, patient_user_id');

  if (!assignments?.length) return { emailsSent: 0, patientsAlerted: 0, skipped: 0 };

  const slpIds     = [...new Set(assignments.map(a => a.slp_user_id))];
  const patientIds = [...new Set(assignments.map(a => a.patient_user_id))];

  // 2. Batch fetch profiles, last sessions, and recent alert log
  const [slpRes, patientRes, sessionsRes, alertsRes] = await Promise.all([
    admin.from('profiles').select('id, display_name, email').in('id', slpIds),
    admin.from('profiles').select('id, display_name, email').in('id', patientIds),
    admin.from('practice_sessions')
      .select('user_id, created_at')
      .in('user_id', patientIds)
      .order('created_at', { ascending: false }),
    // All slp_patient_inactive alerts sent to these SLTs within the cooldown window
    admin.from('notification_log')
      .select('user_id, metadata')
      .in('user_id', slpIds)
      .eq('type', 'slp_patient_inactive')
      .gte('sent_at', cooldownCutoff),
  ]);

  // Build lookup maps
  const slpProfiles     = new Map((slpRes.data     ?? []).map(p => [p.id, p]));
  const patientProfiles = new Map((patientRes.data  ?? []).map(p => [p.id, p]));

  // Last session per patient (sessions are ordered desc, so first hit is latest)
  const lastSessionAt = new Map<string, string>();
  for (const s of (sessionsRes.data ?? [])) {
    if (!lastSessionAt.has(s.user_id)) lastSessionAt.set(s.user_id, s.created_at);
  }

  // Recently alerted patient IDs per SLT (to enforce cooldown)
  const recentAlerts = new Map<string, Set<string>>(); // slpId → Set<patientId>
  for (const row of (alertsRes.data ?? [])) {
    const pid = (row.metadata as Record<string, unknown>)?.patient_user_id as string | undefined;
    if (!pid) continue;
    if (!recentAlerts.has(row.user_id)) recentAlerts.set(row.user_id, new Set());
    recentAlerts.get(row.user_id)!.add(pid);
  }

  // 3. Build per-SLT digest lists
  const digestBySlp = new Map<string, InactivePatient[]>();
  let skipped = 0;

  for (const a of assignments) {
    const last = lastSessionAt.get(a.patient_user_id);
    const daysSince = last
      ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400_000)
      : 999; // never practised

    if (daysSince < INACTIVITY_DAYS) { skipped++; continue; }

    // Cooldown check — don't re-alert about this patient this week
    if (recentAlerts.get(a.slp_user_id)?.has(a.patient_user_id)) { skipped++; continue; }

    const patient = patientProfiles.get(a.patient_user_id);
    if (!patient?.email) { skipped++; continue; }

    if (!digestBySlp.has(a.slp_user_id)) digestBySlp.set(a.slp_user_id, []);
    digestBySlp.get(a.slp_user_id)!.push({
      patientId:    a.patient_user_id,
      patientName:  patient.display_name ?? patient.email.split('@')[0],
      patientEmail: patient.email,
      daysSince,
    });
  }

  // 4. Send one digest per SLT, then log each patient alerted
  let emailsSent    = 0;
  let patientsAlerted = 0;

  for (const [slpId, patients] of digestBySlp) {
    const slp = slpProfiles.get(slpId);
    if (!slp?.email) continue;

    const ok = await sendSlpInactivityDigest({
      slpEmail:  slp.email,
      slpName:   slp.display_name ?? slp.email.split('@')[0],
      patients,
    });

    if (ok) {
      emailsSent++;
      patientsAlerted += patients.length;

      // Log one record per patient so the cooldown check works at patient granularity
      await Promise.all(patients.map(p =>
        admin.from('notification_log').insert({
          user_id:  slpId,
          type:     'slp_patient_inactive',
          metadata: {
            patient_user_id: p.patientId,
            patient_email:   p.patientEmail,
            days_since:      p.daysSince,
          },
        })
      ));
    }
  }

  return { emailsSent, patientsAlerted, skipped };
}
