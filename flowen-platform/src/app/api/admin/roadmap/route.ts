import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RoadmapMilestone {
  id:           string;
  phase:        'launch' | 'nhs_pilot' | 'scale';
  category:     'product' | 'compliance' | 'commercial' | 'fundraising' | 'team';
  title:        string;
  description:  string | null;
  status:       'planned' | 'in_progress' | 'complete' | 'blocked' | 'deferred';
  target_date:  string | null;
  completed_at: string | null;
  owner:        string | null;
  priority:     'critical' | 'high' | 'medium' | 'low';
  notes:        string | null;
  created_at:   string;
}

// ── DB client ──────────────────────────────────────────────────────────────────

// ── Seed data ──────────────────────────────────────────────────────────────────

const SEED_MILESTONES = [
  // Phase: launch
  {
    phase:       'launch',
    category:    'compliance',
    title:       'DCB0129 Clinical Safety Case',
    description: 'Complete the clinical safety case document and obtain sign-off from Clinical Safety Officer for the AI speech therapy platform.',
    status:      'in_progress',
    target_date: '2026-08-31',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Required before any NHS clinical deployment. Must demonstrate hazard identification and risk mitigation.',
  },
  {
    phase:       'launch',
    category:    'compliance',
    title:       'DTAC Submission',
    description: 'Submit Digital Technology Assessment Criteria evidence pack to NHS Digital for evaluation.',
    status:      'planned',
    target_date: '2026-09-30',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'DTAC covers clinical safety, data protection, technical security, interoperability, and usability.',
  },
  {
    phase:       'launch',
    category:    'product',
    title:       'App Store Launch (iOS)',
    description: 'Publish Flowen AI speech therapy app to Apple App Store for public access.',
    status:      'in_progress',
    target_date: '2026-09-01',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Requires App Store Review approval. Medical app category — allow extra review time.',
  },
  {
    phase:       'launch',
    category:    'commercial',
    title:       'First 100 Registered Users',
    description: 'Reach 100 registered users on the Flowen platform through waitlist conversion and organic growth.',
    status:      'planned',
    target_date: '2026-10-31',
    completed_at: null,
    owner:       null,
    priority:    'high',
    notes:       'Key early traction metric for pre-seed investors and NHS procurement conversations.',
  },
  {
    phase:       'launch',
    category:    'fundraising',
    title:       'SBRI Healthcare Phase 1 Submission',
    description: 'Submit SBRI Healthcare Phase 1 application for NHS England feasibility study funding.',
    status:      'complete',
    target_date: '2026-07-20',
    completed_at: '2026-07-20',
    owner:       null,
    priority:    'high',
    notes:       'Submitted on time. Awaiting decision — typically 6–8 weeks.',
  },
  {
    phase:       'launch',
    category:    'fundraising',
    title:       'SEIS Advance Assurance',
    description: 'Obtain HMRC Advance Assurance for Seed Enterprise Investment Scheme to enable investor tax relief.',
    status:      'in_progress',
    target_date: '2026-08-15',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Required before closing pre-seed round. Application submitted — HMRC typically 8 weeks.',
  },
  {
    phase:       'launch',
    category:    'product',
    title:       'SLP Beta Portal (10 SLPs)',
    description: 'Launch beta portal for Speech and Language Pathologists to monitor patient progress and assign exercises.',
    status:      'planned',
    target_date: '2026-10-31',
    completed_at: null,
    owner:       null,
    priority:    'high',
    notes:       'Targeting 10 SLPs for beta programme. Key for NHS pilot evidence base.',
  },
  {
    phase:       'launch',
    category:    'commercial',
    title:       'Waitlist — 500 Signups',
    description: 'Build pre-launch waitlist to 500 email signups, validating demand before App Store launch.',
    status:      'complete',
    target_date: '2026-07-01',
    completed_at: '2026-07-01',
    owner:       null,
    priority:    'medium',
    notes:       'Target exceeded. Strong signal for investor deck and NHS pilot conversations.',
  },
  // Phase: nhs_pilot
  {
    phase:       'nhs_pilot',
    category:    'commercial',
    title:       'First ICB Pilot Contract (verbal)',
    description: 'Secure verbal commitment or LOI from first Integrated Care Board for a paid NHS pilot programme.',
    status:      'planned',
    target_date: '2027-01-31',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Target ICBs with active digital health or speech therapy commissioning gaps.',
  },
  {
    phase:       'nhs_pilot',
    category:    'compliance',
    title:       'DSPT Compliance',
    description: 'Achieve NHS Data Security and Protection Toolkit compliance to handle patient data in NHS settings.',
    status:      'planned',
    target_date: '2026-12-31',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Mandatory for NHS data processing. Annual submission. Requires ISO 27001 alignment.',
  },
  {
    phase:       'nhs_pilot',
    category:    'product',
    title:       'SLP Portal Full Launch',
    description: 'Full production launch of the Speech and Language Pathologist portal with caseload management, progress tracking, and exercise assignment.',
    status:      'planned',
    target_date: '2027-02-28',
    completed_at: null,
    owner:       null,
    priority:    'high',
    notes:       'Core differentiator for NHS procurement — enables SLP-supervised AI therapy at scale.',
  },
  {
    phase:       'nhs_pilot',
    category:    'commercial',
    title:       'First 500 Platform Users',
    description: 'Reach 500 active users across consumer and NHS pilot channels.',
    status:      'planned',
    target_date: '2027-03-31',
    completed_at: null,
    owner:       null,
    priority:    'high',
    notes:       'Combined target: direct consumer + NHS pilot participants. Key Series A metric.',
  },
  {
    phase:       'nhs_pilot',
    category:    'fundraising',
    title:       'Pre-seed Round Close (£500k)',
    description: 'Close £500k pre-seed round via SEIS/EIS to fund 18 months runway through NHS pilot.',
    status:      'planned',
    target_date: '2026-12-31',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Target: 3–5 angel investors. SEIS advance assurance required. Lead with NHS traction story.',
  },
  {
    phase:       'nhs_pilot',
    category:    'compliance',
    title:       'DCB0148 (Deployment Safety)',
    description: 'Complete DCB0148 clinical risk management standard for deployment and ongoing monitoring of the platform in NHS settings.',
    status:      'planned',
    target_date: '2027-01-31',
    completed_at: null,
    owner:       null,
    priority:    'high',
    notes:       'Companion standard to DCB0129 covering ongoing clinical risk management post-deployment.',
  },
  {
    phase:       'nhs_pilot',
    category:    'product',
    title:       'Android App Launch',
    description: 'Publish Flowen app to Google Play Store to reach Android users and NHS pilot participants on NHS-issued Android devices.',
    status:      'planned',
    target_date: '2027-04-30',
    completed_at: null,
    owner:       null,
    priority:    'medium',
    notes:       'NHS trusts predominantly use Android. Required for full NHS pilot participation.',
  },
  // Phase: scale
  {
    phase:       'scale',
    category:    'commercial',
    title:       '5 ICB Contracts',
    description: 'Scale to 5 active Integrated Care Board contracts across England for NHS speech therapy service delivery.',
    status:      'planned',
    target_date: '2027-09-30',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Each ICB contract = £50–200k ARR potential. Target ICBs with highest stammering prevalence.',
  },
  {
    phase:       'scale',
    category:    'fundraising',
    title:       'Seed Round (£2M)',
    description: 'Close £2M seed round (EIS) to fund national NHS rollout, team expansion, and Series A preparation.',
    status:      'planned',
    target_date: '2027-06-30',
    completed_at: null,
    owner:       null,
    priority:    'critical',
    notes:       'Lead with 5 ICB contracts and NICE evidence. Target specialist health-tech VCs.',
  },
  {
    phase:       'scale',
    category:    'commercial',
    title:       '10,000 Platform Users',
    description: 'Reach 10,000 active platform users across NHS and direct-to-consumer channels.',
    status:      'planned',
    target_date: '2027-12-31',
    completed_at: null,
    owner:       null,
    priority:    'high',
    notes:       'Combined NHS pilot participants + consumer subscribers. Key Series A proof point.',
  },
  {
    phase:       'scale',
    category:    'compliance',
    title:       'NICE Evidence Submission',
    description: 'Submit evidence to NICE for consideration of Flowen in evidence-based guidelines for stammering treatment.',
    status:      'planned',
    target_date: '2028-06-30',
    completed_at: null,
    owner:       null,
    priority:    'medium',
    notes:       'Long-term moat — NICE endorsement would mandate NHS consideration. Requires RCT data.',
  },
  {
    phase:       'scale',
    category:    'fundraising',
    title:       'Series A Preparation',
    description: 'Prepare Series A fundraising materials, financial model, and investor pipeline for £5–10M raise.',
    status:      'planned',
    target_date: '2028-01-31',
    completed_at: null,
    owner:       null,
    priority:    'high',
    notes:       'Target: 10 ICBs, NICE submission in progress, £500k+ ARR. Lead with NHS national rollout narrative.',
  },
];

// ── Phase order ────────────────────────────────────────────────────────────────

const PHASE_ORDER: Record<string, number> = { launch: 0, nhs_pilot: 1, scale: 2 };

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();
  const { data, error } = await client
    .from('roadmap_milestones')
    .select('*')
    .order('target_date', { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ milestones: [] });
  }

  // Sort by phase order, then target_date
  const sorted = (data ?? []).slice().sort((a, b) => {
    const pa = PHASE_ORDER[a.phase] ?? 99;
    const pb = PHASE_ORDER[b.phase] ?? 99;
    if (pa !== pb) return pa - pb;
    if (!a.target_date && !b.target_date) return 0;
    if (!a.target_date) return 1;
    if (!b.target_date) return -1;
    return a.target_date.localeCompare(b.target_date);
  });

  return NextResponse.json({ milestones: sorted });
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
      .from('roadmap_milestones')
      .insert({
        phase:        body.phase        ?? 'launch',
        category:     body.category     ?? 'product',
        title:        body.title,
        description:  body.description  ?? null,
        status:       body.status       ?? 'planned',
        target_date:  body.target_date  ?? null,
        completed_at: body.completed_at ?? null,
        owner:        body.owner        ?? null,
        priority:     body.priority     ?? 'medium',
        notes:        body.notes        ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'roadmap.milestone_added', resource_type: 'roadmap_milestone', resource_id: data.id, metadata: { title: data.title, phase: data.phase, status: data.status }, severity: 'info' });
    return NextResponse.json({ milestone: data });
  }

  // ── update ─────────────────────────────────────────────────────────────────

  if (action === 'update') {
    const { id } = body as { id: string };
    const { data, error } = await client
      .from('roadmap_milestones')
      .update({
        phase:        body.phase,
        category:     body.category,
        title:        body.title,
        description:  body.description  ?? null,
        status:       body.status,
        target_date:  body.target_date  ?? null,
        completed_at: body.completed_at ?? null,
        owner:        body.owner        ?? null,
        priority:     body.priority,
        notes:        body.notes        ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'roadmap.milestone_updated', resource_type: 'roadmap_milestone', resource_id: data.id, metadata: { title: data.title, status: data.status }, severity: 'info' });
    return NextResponse.json({ milestone: data });
  }

  // ── delete ─────────────────────────────────────────────────────────────────

  if (action === 'delete') {
    const { id } = body as { id: string };
    const { data: milestoneRow } = await client.from('roadmap_milestones').select('title').eq('id', id).single();
    const { error } = await client.from('roadmap_milestones').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'roadmap.milestone_deleted', resource_type: 'roadmap_milestone', resource_id: id, metadata: { title: milestoneRow?.title ?? null }, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  // ── seed ───────────────────────────────────────────────────────────────────

  if (action === 'seed') {
    const { count } = await client
      .from('roadmap_milestones')
      .select('*', { count: 'exact', head: true });

    if ((count ?? 0) >= 5) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { error } = await client.from('roadmap_milestones').insert(SEED_MILESTONES);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data } = await client
      .from('roadmap_milestones')
      .select('*')
      .order('target_date', { ascending: true, nullsFirst: false });

    const sorted = (data ?? []).slice().sort((a, b) => {
      const pa = PHASE_ORDER[a.phase] ?? 99;
      const pb = PHASE_ORDER[b.phase] ?? 99;
      if (pa !== pb) return pa - pb;
      if (!a.target_date && !b.target_date) return 0;
      if (!a.target_date) return 1;
      if (!b.target_date) return -1;
      return a.target_date.localeCompare(b.target_date);
    });

    return NextResponse.json({ milestones: sorted });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
