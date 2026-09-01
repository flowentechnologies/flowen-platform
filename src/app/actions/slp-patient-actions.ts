'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { sendPatientDischargeNotification } from '@/lib/email';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Add session note ───────────────────────────────────────────────────────────

export async function addSessionNote({
  patientId, slpId, sessionId, note,
}: {
  patientId: string;
  slpId: string;
  sessionId: string | null;
  note: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!note.trim()) return { ok: false, error: 'Note is required.' };

  const { error } = await db()
    .from('slp_session_notes')
    .insert({
      slp_user_id:     slpId,
      patient_user_id: patientId,
      session_id:      sessionId ?? null, // null = general note not tied to a specific session
      note:            note.trim(),
    });

  if (error) return { ok: false, error: error.message };

  updateTag('slp-patient-sessions');
  revalidatePath(`/slp/patients/${patientId}`);
  return { ok: true };
}

// ── Update treatment plan ──────────────────────────────────────────────────────

export async function updateTreatmentPlan({
  planId, phase, sessions_per_week, minutes_per_session, goals,
}: {
  planId: string;
  phase: string;
  sessions_per_week: number;
  minutes_per_session: number;
  goals: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db()
    .from('treatment_plans')
    .update({ phase, sessions_per_week, minutes_per_session, goals, updated_at: new Date().toISOString() })
    .eq('id', planId);

  if (error) return { ok: false, error: error.message };
  updateTag('slp-patient-sessions');
  return { ok: true };
}

// ── Enrol patient ──────────────────────────────────────────────────────────────

export async function enrolPatient({
  patientEmail,
  slpId,
  phase,
  sessionsPerWeek,
  minutesPerSession,
  goals,
  prescribedStages,
}: {
  patientEmail: string;
  slpId: string;
  phase: string;
  sessionsPerWeek: number;
  minutesPerSession: number;
  goals: string;
  prescribedStages: number[];
}): Promise<{ ok: boolean; error?: string; patientId?: string }> {
  const supabase = db();

  // Look up patient by email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', patientEmail.toLowerCase().trim())
    .single();

  if (!profile) {
    return {
      ok: false,
      error: 'No Flowen account found for that email address. The patient must sign up first.',
    };
  }

  const patientId = profile.id;

  // Check not already assigned
  const { data: existing } = await supabase
    .from('slp_assignments')
    .select('id')
    .eq('slp_user_id', slpId)
    .eq('patient_user_id', patientId)
    .single();

  if (existing) {
    return { ok: false, error: 'This patient is already in your caseload.' };
  }

  // Create assignment + treatment plan in parallel
  const [assignRes, planRes] = await Promise.all([
    supabase.from('slp_assignments').insert({
      slp_user_id:     slpId,
      patient_user_id: patientId,
      assigned_by:     slpId,
    }),
    supabase.from('treatment_plans').insert({
      slp_user_id:         slpId,
      patient_user_id:     patientId,
      phase,
      sessions_per_week:   sessionsPerWeek,
      minutes_per_session: minutesPerSession,
      goals:               goals.trim(),
      prescribed_stages:   prescribedStages,
      active:              true,
    }),
  ]);

  if (assignRes.error) return { ok: false, error: assignRes.error.message };
  if (planRes.error)   return { ok: false, error: planRes.error.message };

  updateTag('slp-caseload');
  revalidatePath('/slp/caseload');
  return { ok: true, patientId };
}

// ── Discharge patient ──────────────────────────────────────────────────────────

export async function dischargePatient({
  patientId,
  slpId,
  patientEmail,
  patientName,
  sendNotification,
  reason,
}: {
  patientId: string;
  slpId: string;
  patientEmail: string;
  patientName: string;
  sendNotification: boolean;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = db();

  // Remove assignment
  const { error: assignError } = await supabase
    .from('slp_assignments')
    .delete()
    .eq('slp_user_id', slpId)
    .eq('patient_user_id', patientId);

  if (assignError) return { ok: false, error: assignError.message };

  // Deactivate treatment plan (non-fatal if none exists)
  await supabase
    .from('treatment_plans')
    .update({ active: false })
    .eq('slp_user_id', slpId)
    .eq('patient_user_id', patientId);

  // Notify patient
  if (sendNotification && patientEmail) {
    await sendPatientDischargeNotification({ patientEmail, patientName, reason });
  }

  updateTag('slp-caseload');
  updateTag('slp-patient-sessions');
  revalidatePath('/slp/caseload');
  return { ok: true };
}
