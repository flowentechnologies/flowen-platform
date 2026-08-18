import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

export interface Assignment {
  id: string;
  slp_user_id: string;
  slp_name: string | null;
  slp_email: string | null;
  patient_user_id: string;
  patient_name: string | null;
  patient_email: string | null;
  assigned_at: string;
  assigned_by: string | null;
  notes: string | null;
}

export interface ClinicianOption {
  id: string;
  display_name: string | null;
  email: string | null;
}

export interface AssignmentsData {
  assignments: Assignment[];
  clinicians: ClinicianOption[];
  patients: ClinicianOption[];
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();

  const [assignmentsRes, cliniciansRes, patientsRes] = await Promise.all([
    client.from('slp_assignments').select('*').order('assigned_at', { ascending: false }),
    // Include both 'slp' (SLT portal) and legacy 'clinician' role
    client.from('profiles').select('id, display_name, email').in('role', ['slp', 'clinician']),
    client.from('profiles').select('id, display_name, email').eq('role', 'patient'),
  ]);

  const profileMap = new Map<string, { display_name: string | null; email: string | null }>();
  for (const p of [...(cliniciansRes.data ?? []), ...(patientsRes.data ?? [])]) {
    profileMap.set(p.id, { display_name: p.display_name, email: p.email });
  }

  const assignments: Assignment[] = (assignmentsRes.data ?? []).map(a => ({
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
  }));

  const data: AssignmentsData = {
    assignments,
    clinicians: cliniciansRes.data ?? [],
    patients: patientsRes.data ?? [],
  };

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();
  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;

  if (action === 'assign') {
    const { slp_user_id, patient_user_id, notes } = body;
    if (!slp_user_id || !patient_user_id) return NextResponse.json({ error: 'slp_user_id and patient_user_id required' }, { status: 400 });
    const { data, error } = await client.from('slp_assignments').insert({
      slp_user_id,
      patient_user_id,
      assigned_by: admin.email,
      notes: notes ?? null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'clinician.assigned', resource_type: 'slp_assignment', resource_id: data.id, metadata: { slp_user_id, patient_user_id }, severity: 'info' });
    return NextResponse.json({ data });
  }

  if (action === 'unassign') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await client.from('slp_assignments').delete().eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'clinician.unassigned', resource_type: 'slp_assignment', resource_id: id as string, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
