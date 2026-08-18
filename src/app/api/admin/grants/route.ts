import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Grant {
  id:               string;
  name:             string;
  funder:           string;
  grant_type:       string;
  amount_pence:     number | null;
  awarded_pence:    number | null;
  status:           string;
  deadline:         string | null;
  submitted_at:     string | null;
  decision_date:    string | null;
  lead_contact:     string | null;
  reference_number: string | null;
  notes:            string | null;
  created_at:       string;
  updated_at:       string;
}

// ── DB client ──────────────────────────────────────────────────────────────────

// ── Seed data ──────────────────────────────────────────────────────────────────

const SEED_GRANTS = [
  {
    name:             'SBRI Healthcare Phase 1',
    funder:           'NHS England / SBRI Healthcare',
    grant_type:       'sbri',
    amount_pence:     10_000_000,   // £100,000
    awarded_pence:    null,
    status:           'submitted',
    deadline:         '2026-09-15',
    submitted_at:     '2026-07-20',
    decision_date:    null,
    lead_contact:     null,
    reference_number: null,
    notes:            'Phase 1 feasibility study. Covers AI-assisted speech therapy platform development and NHS validation.',
  },
  {
    name:             'Innovate UK Smart Grant',
    funder:           'Innovate UK',
    grant_type:       'innovate_uk',
    amount_pence:     50_000_000,   // £500,000
    awarded_pence:    null,
    status:           'drafting',
    deadline:         '2026-10-31',
    submitted_at:     null,
    decision_date:    null,
    lead_contact:     null,
    reference_number: null,
    notes:            'R&D grant for AI speech therapy innovation. 9–12 month review cycle expected.',
  },
  {
    name:             'NIHR i4i Connect',
    funder:           'National Institute for Health Research',
    grant_type:       'nihr',
    amount_pence:     100_000_000,  // £1,000,000
    awarded_pence:    null,
    status:           'researching',
    deadline:         '2026-12-01',
    submitted_at:     null,
    decision_date:    null,
    lead_contact:     null,
    reference_number: null,
    notes:            'Invention for Innovation programme — ideal for NHS-integrated medical software. Requires clinical partner letter.',
  },
  {
    name:             'SEIS Advance Assurance',
    funder:           'HMRC',
    grant_type:       'seis_eis',
    amount_pence:     25_000_000,   // £250,000
    awarded_pence:    null,
    status:           'under_review',
    deadline:         null,
    submitted_at:     '2026-06-15',
    decision_date:    null,
    lead_contact:     null,
    reference_number: null,
    notes:            'Advance assurance application submitted. Required for investor tax relief eligibility.',
  },
  {
    name:             'Wellcome Trust Health Innovation',
    funder:           'Wellcome Trust',
    grant_type:       'wellcome',
    amount_pence:     25_000_000,   // £250,000
    awarded_pence:    null,
    status:           'researching',
    deadline:         null,
    submitted_at:     null,
    decision_date:    null,
    lead_contact:     null,
    reference_number: null,
    notes:            'Health innovation grant. Strong alignment with Flowen speech AI mission.',
  },
  {
    name:             'Health Foundation Improvement Grant',
    funder:           'The Health Foundation',
    grant_type:       'private',
    amount_pence:     15_000_000,   // £150,000
    awarded_pence:    null,
    status:           'researching',
    deadline:         null,
    submitted_at:     null,
    decision_date:    null,
    lead_contact:     null,
    reference_number: null,
    notes:            'Private foundation grant for NHS-aligned digital health improvement programmes.',
  },
];

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();
  const { data, error } = await client
    .from('grants')
    .select('*')
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    // Graceful empty if table missing
    return NextResponse.json({ grants: [] });
  }

  return NextResponse.json({ grants: data ?? [] });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const { action } = body;
  const client = db();

  // ── add ────────────────────────────────────────────────────────────────────

  if (action === 'add') {
    const { data, error } = await client
      .from('grants')
      .insert({
        name:             body.name,
        funder:           body.funder,
        grant_type:       body.grant_type       ?? 'other',
        amount_pence:     body.amount_pence      ?? null,
        awarded_pence:    body.awarded_pence     ?? null,
        status:           body.status            ?? 'researching',
        deadline:         body.deadline          ?? null,
        submitted_at:     body.submitted_at      ?? null,
        decision_date:    body.decision_date     ?? null,
        lead_contact:     body.lead_contact      ?? null,
        reference_number: body.reference_number  ?? null,
        notes:            body.notes             ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'grant.add', resource_type: 'grant', resource_id: data.id, metadata: { name: data.name, grant_type: data.grant_type, amount_pence: data.amount_pence }, severity: 'info' });
    return NextResponse.json({ grant: data });
  }

  // ── update ─────────────────────────────────────────────────────────────────

  if (action === 'update') {
    const { id } = body as { id: string };
    const { data, error } = await client
      .from('grants')
      .update({
        name:             body.name,
        funder:           body.funder,
        grant_type:       body.grant_type,
        amount_pence:     body.amount_pence      ?? null,
        awarded_pence:    body.awarded_pence     ?? null,
        status:           body.status,
        deadline:         body.deadline          ?? null,
        submitted_at:     body.submitted_at      ?? null,
        decision_date:    body.decision_date     ?? null,
        lead_contact:     body.lead_contact      ?? null,
        reference_number: body.reference_number  ?? null,
        notes:            body.notes             ?? null,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'grant.update', resource_type: 'grant', resource_id: data.id, metadata: { status: data.status }, severity: 'info' });
    return NextResponse.json({ grant: data });
  }

  // ── delete ─────────────────────────────────────────────────────────────────

  if (action === 'delete') {
    const { id } = body as { id: string };
    const { error } = await client.from('grants').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'grant.delete', resource_type: 'grant', resource_id: id, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  // ── seed ───────────────────────────────────────────────────────────────────

  if (action === 'seed') {
    const { count } = await client.from('grants').select('*', { count: 'exact', head: true });
    if ((count ?? 0) >= 3) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const { error } = await client.from('grants').insert(SEED_GRANTS);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const { data } = await client
      .from('grants')
      .select('*')
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    return NextResponse.json({ grants: data ?? [] });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
