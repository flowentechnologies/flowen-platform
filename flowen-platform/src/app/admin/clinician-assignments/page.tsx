import { assertAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { ClinicianAssignmentsClient } from './ClinicianAssignmentsClient';
import type { AssignmentsData } from '@/app/api/admin/clinician-assignments/route';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function ClinicianAssignmentsPage() {
  await assertAdmin();
  const client = db();

  const [assignmentsRes, cliniciansRes, patientsRes] = await Promise.all([
    client.from('slp_assignments').select('*').order('assigned_at', { ascending: false }),
    client.from('profiles').select('id, display_name, email').eq('role', 'clinician'),
    client.from('profiles').select('id, display_name, email').eq('role', 'pwds'),
  ]);

  const profileMap = new Map<string, { display_name: string | null; email: string | null }>();
  for (const p of [...(cliniciansRes.data ?? []), ...(patientsRes.data ?? [])]) {
    profileMap.set(p.id, { display_name: p.display_name, email: p.email });
  }

  const data: AssignmentsData = {
    assignments: (assignmentsRes.data ?? []).map(a => ({
      id: a.id,
      slp_user_id: a.slp_user_id,
      slp_name: profileMap.get(a.slp_user_id)?.display_name ?? null,
      slp_email: profileMap.get(a.slp_user_id)?.email ?? null,
      patient_user_id: a.patient_user_id,
      patient_name: profileMap.get(a.patient_user_id)?.display_name ?? null,
      patient_email: profileMap.get(a.patient_user_id)?.email ?? null,
      assigned_at: a.assigned_at,
      assigned_by: a.assigned_by,
      notes: a.notes,
    })),
    clinicians: cliniciansRes.data ?? [],
    patients: patientsRes.data ?? [],
  };

  return <ClinicianAssignmentsClient initialData={data} />;
}
