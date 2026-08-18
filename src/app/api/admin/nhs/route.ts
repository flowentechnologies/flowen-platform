import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ICBContact {
  id: string;
  icb_name: string;
  region: string | null;
  stage: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  last_contact_at: string | null;
  next_action: string | null;
  patient_population: number | null;
  notes: string | null;
  created_at: string;
}

export interface SLPSignup {
  id: string;
  name: string;
  email: string;
  organisation: string | null;
  role: string | null;
  region: string | null;
  signup_date: string | null;
  activated: boolean;
  patient_referrals: number;
  notes: string | null;
  created_at: string;
}

export interface BlockPledge {
  id: string;
  icb_name: string;
  contact_name: string | null;
  patients_covered: number | null;
  contract_value_pence: number | null;
  status: string;
  expected_start_date: string | null;
  actual_start_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface NHSData {
  icbContacts: ICBContact[];
  slpSignups: SLPSignup[];
  blockPledges: BlockPledge[];
}

// ── Column allowlists ──────────────────────────────────────────────────────────

const ICB_COLUMNS = new Set([
  'icb_name', 'region', 'stage', 'contact_name', 'contact_email',
  'contact_role', 'last_contact_at', 'next_action', 'patient_population', 'notes',
]);

const SLP_COLUMNS = new Set([
  'name', 'email', 'organisation', 'role', 'region',
  'signup_date', 'activated', 'patient_referrals', 'notes',
]);

const PLEDGE_COLUMNS = new Set([
  'icb_name', 'contact_name', 'patients_covered', 'contract_value_pence',
  'status', 'expected_start_date', 'actual_start_date', 'notes',
]);

function pick(obj: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.has(k)));
}

// ── DB client ──────────────────────────────────────────────────────────────────

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();

  const [icbRes, slpRes, pledgeRes] = await Promise.all([
    client.from('nhs_icb_contacts').select('*').order('created_at', { ascending: false }),
    client.from('nhs_slp_signups').select('*').order('created_at', { ascending: false }),
    client.from('nhs_block_pledges').select('*').order('created_at', { ascending: false }),
  ]);

  const data: NHSData = {
    icbContacts:  icbRes.error    ? [] : (icbRes.data    ?? []),
    slpSignups:   slpRes.error    ? [] : (slpRes.data    ?? []),
    blockPledges: pledgeRes.error ? [] : (pledgeRes.data ?? []),
  };

  return NextResponse.json(data);
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;
  const client = db();

  // ── ICB contacts ──────────────────────────────────────────────────────────

  if (action === 'add_icb') {
    const payload: Record<string, unknown> = {
      icb_name:           body.icb_name,
      region:             body.region             ?? null,
      stage:              body.stage              ?? 'prospecting',
      contact_name:       body.contact_name       ?? null,
      contact_email:      body.contact_email      ?? null,
      contact_role:       body.contact_role       ?? null,
      last_contact_at:    body.last_contact_at    ?? null,
      next_action:        body.next_action        ?? null,
      patient_population: body.patient_population ?? null,
      notes:              body.notes              ?? null,
    };
    const { data, error } = await client.from('nhs_icb_contacts').insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'nhs.icb_added', resource_type: 'nhs_icb_contact', resource_id: data.id, metadata: { icb_name: data.icb_name, stage: data.stage }, severity: 'info' });
    return NextResponse.json({ data });
  }

  if (action === 'update_icb') {
    const { id, action: _a, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = pick(rest, ICB_COLUMNS);
    const { data, error } = await client
      .from('nhs_icb_contacts')
      .update(fields)
      .eq('id', id as string)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'nhs.icb_updated', resource_type: 'nhs_icb_contact', resource_id: data.id, metadata: { stage: data.stage }, severity: 'info' });
    return NextResponse.json({ data });
  }

  if (action === 'delete_icb') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await client.from('nhs_icb_contacts').delete().eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'nhs.icb_deleted', resource_type: 'nhs_icb_contact', resource_id: id as string, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  // ── SLP signups ───────────────────────────────────────────────────────────

  if (action === 'add_slp') {
    const payload: Record<string, unknown> = {
      name:              body.name,
      email:             body.email,
      organisation:      body.organisation      ?? null,
      role:              body.role              ?? null,
      region:            body.region            ?? null,
      signup_date:       body.signup_date       ?? new Date().toISOString(),
      activated:         body.activated         ?? false,
      patient_referrals: body.patient_referrals ?? 0,
      notes:             body.notes             ?? null,
    };
    const { data, error } = await client.from('nhs_slp_signups').insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'nhs.slp_added', resource_type: 'nhs_slp_signup', resource_id: data.id, severity: 'info' });
    return NextResponse.json({ data });
  }

  if (action === 'update_slp') {
    const { id, action: _a, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = pick(rest, SLP_COLUMNS);
    const { data, error } = await client
      .from('nhs_slp_signups')
      .update(fields)
      .eq('id', id as string)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (action === 'delete_slp') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await client.from('nhs_slp_signups').delete().eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'nhs.slp_deleted', resource_type: 'nhs_slp_signup', resource_id: id as string, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  // ── Block pledges ─────────────────────────────────────────────────────────

  if (action === 'add_pledge') {
    const payload: Record<string, unknown> = {
      icb_name:             body.icb_name,
      contact_name:         body.contact_name         ?? null,
      patients_covered:     body.patients_covered     ?? null,
      contract_value_pence: body.contract_value_pence ?? null,
      status:               body.status               ?? 'verbal',
      expected_start_date:  body.expected_start_date  ?? null,
      actual_start_date:    body.actual_start_date    ?? null,
      notes:                body.notes                ?? null,
    };
    const { data, error } = await client.from('nhs_block_pledges').insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'nhs.pledge_added', resource_type: 'nhs_block_pledge', resource_id: data.id, metadata: { icb_name: data.icb_name, contract_value_pence: data.contract_value_pence }, severity: 'info' });
    return NextResponse.json({ data });
  }

  if (action === 'update_pledge') {
    const { id, action: _a, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const fields = pick(rest, PLEDGE_COLUMNS);
    const { data, error } = await client
      .from('nhs_block_pledges')
      .update(fields)
      .eq('id', id as string)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  if (action === 'delete_pledge') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await client.from('nhs_block_pledges').delete().eq('id', id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'nhs.pledge_deleted', resource_type: 'nhs_block_pledge', resource_id: id as string, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
