import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/admin/audit';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AuditCategory = 'patents' | 'trademarks' | 'ai_models' | 'data_datasets' | 'software' | 'trade_secrets' | 'contracts';
export type AuditStatus   = 'not_started' | 'in_progress' | 'complete' | 'blocked' | 'waived';
export type RiskLevel     = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type FundingType   = 'grant' | 'loan' | 'tax_relief' | 'licensing' | 'partnership' | 'legal_aid' | 'equity';
export type FundingStatus = 'researching' | 'eligible' | 'applied' | 'in_progress' | 'awarded' | 'rejected' | 'not_eligible' | 'on_hold';

export interface AuditItem {
  id:           string;
  category:     AuditCategory;
  title:        string;
  description:  string | null;
  status:       AuditStatus;
  risk_level:   RiskLevel;
  priority:     number;
  assignee:     string | null;
  due_date:     string | null;
  evidence_url: string | null;
  notes:        string | null;
  created_at:   string;
  updated_at:   string;
}

export interface FundingItem {
  id:               string;
  program_type:     FundingType;
  name:             string;
  provider:         string;
  description:      string | null;
  status:           FundingStatus;
  min_amount_pence: number | null;
  max_amount_pence: number | null;
  deadline:         string | null;
  url:              string | null;
  lead_contact:     string | null;
  notes:            string | null;
  created_at:       string;
  updated_at:       string;
}

// ── DB client ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── Seed data ──────────────────────────────────────────────────────────────────

const SEED_AUDIT: Omit<AuditItem, 'id' | 'created_at' | 'updated_at'>[] = [
  // Patents
  { category: 'patents', title: 'Disfluency Detection Method Patent', description: 'Core ASR disfluency detection and biofeedback algorithm — assess patentability with a UK/US patent attorney', status: 'not_started', risk_level: 'high', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: 'Innovate UK grants can fund patent filing costs' },
  { category: 'patents', title: 'Waveform Visualisation Method', description: 'Dual-waveform biofeedback UI patent potential — assess innovation over prior art', status: 'not_started', risk_level: 'medium', priority: 3, assignee: null, due_date: null, evidence_url: null, notes: null },

  // Trademarks
  { category: 'trademarks', title: 'FLOWEN Wordmark — UK Class 42', description: 'Software-as-a-service in class 42 (scientific/technological services)', status: 'in_progress', risk_level: 'high', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: 'Application in progress with IPO' },
  { category: 'trademarks', title: 'FLOWEN Wordmark — UK Class 10', description: 'Medical devices / therapeutic apparatus class 10', status: 'not_started', risk_level: 'high', priority: 2, assignee: null, due_date: null, evidence_url: null, notes: 'Required for NHS procurement readiness' },
  { category: 'trademarks', title: 'Flowen Dual-Waveform Logo', description: 'Distinctive gradient waveform logomark', status: 'not_started', risk_level: 'medium', priority: 3, assignee: null, due_date: null, evidence_url: null, notes: null },
  { category: 'trademarks', title: '"Every word gets there." Tagline', description: 'Registered slogan / tagline trademark', status: 'not_started', risk_level: 'low', priority: 4, assignee: null, due_date: null, evidence_url: null, notes: null },

  // AI Models
  { category: 'ai_models', title: 'ASR Model IP Assignment from Founders', description: 'Ensure all IP in the core ASR model is formally assigned from founders to Flowen Technologies Ltd', status: 'not_started', risk_level: 'critical', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: 'Critical for investor diligence — must be complete before term sheet' },
  { category: 'ai_models', title: 'AI Training Dataset IP Verification', description: 'Verify ownership / licence of all training data sources used in ASR model fine-tuning', status: 'not_started', risk_level: 'critical', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: 'Check all audio corpora for licence compliance' },
  { category: 'ai_models', title: 'Open-Source Component Audit', description: 'Audit all third-party open-source libraries in the ASR pipeline for licence compatibility', status: 'not_started', risk_level: 'high', priority: 2, assignee: null, due_date: null, evidence_url: null, notes: 'Watch for GPL/AGPL components that could affect commercial use' },
  { category: 'ai_models', title: 'Model Version Control & Checksums', description: 'Document and hash-lock all production model versions for audit trail', status: 'in_progress', risk_level: 'medium', priority: 3, assignee: null, due_date: null, evidence_url: null, notes: 'Tracked in Model Registry tab of IP Register' },

  // Data & Datasets
  { category: 'data_datasets', title: 'Proprietary Disfluent Speech Dataset', description: 'Catalogue and protect the 100k+ clip disfluent audio training corpus as a proprietary asset', status: 'not_started', risk_level: 'high', priority: 2, assignee: null, due_date: null, evidence_url: null, notes: 'Consider database right (EU) / copyright protections' },
  { category: 'data_datasets', title: 'User-Consented Session Data Policy', description: 'Ensure all user-recorded sessions have appropriate consent for model training use', status: 'in_progress', risk_level: 'high', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: 'GDPR Art. 6 lawful basis must be documented' },
  { category: 'data_datasets', title: 'Synthetic Data Generation Rights', description: 'Document IP rights for any synthetically generated audio used in training', status: 'not_started', risk_level: 'medium', priority: 3, assignee: null, due_date: null, evidence_url: null, notes: null },

  // Software
  { category: 'software', title: 'Flowen Platform Source Code Assignment', description: 'Confirm all platform code is assigned to Flowen Technologies Ltd (not retained by any contractor)', status: 'not_started', risk_level: 'critical', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: 'Review any contractor agreements — add IP assignment clauses' },
  { category: 'software', title: 'Software Copyright Registration', description: 'Register copyright in the core Flowen application with the IPO', status: 'not_started', risk_level: 'low', priority: 4, assignee: null, due_date: null, evidence_url: null, notes: 'Automatic in UK but explicit registration strengthens claims' },
  { category: 'software', title: 'Dependency Licence Compliance Scan', description: 'Run automated licence scanning (e.g. FOSSA, Snyk) on all npm dependencies', status: 'not_started', risk_level: 'medium', priority: 3, assignee: null, due_date: null, evidence_url: null, notes: null },

  // Trade Secrets
  { category: 'trade_secrets', title: 'Disfluency Algorithm Trade Secret Protection', description: 'Implement trade secret policy, NDA regime, and need-to-know access for core algorithm', status: 'not_started', risk_level: 'high', priority: 2, assignee: null, due_date: null, evidence_url: null, notes: 'Trade secret can complement or substitute patent in some cases' },
  { category: 'trade_secrets', title: 'Employee & Contractor NDA Coverage', description: 'Audit all team NDAs — ensure they cover AI model architecture and training data', status: 'in_progress', risk_level: 'high', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: null },

  // Contracts
  { category: 'contracts', title: 'Founder IP Assignment Deed', description: 'Formally assign all pre-incorporation IP from founders to the company via a signed deed', status: 'not_started', risk_level: 'critical', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: 'Blocking issue for Series A — most investors require this before term sheet' },
  { category: 'contracts', title: 'Employment Contracts — IP Clauses', description: 'Verify all employee contracts contain appropriate IP ownership and assignment clauses', status: 'in_progress', risk_level: 'high', priority: 1, assignee: null, due_date: null, evidence_url: null, notes: null },
  { category: 'contracts', title: 'Adviser / Advisor Agreements', description: 'Ensure any advisers or consultants have appropriate IP clauses where they contribute to tech', status: 'not_started', risk_level: 'medium', priority: 2, assignee: null, due_date: null, evidence_url: null, notes: null },
];

const SEED_FUNDING: Omit<FundingItem, 'id' | 'created_at' | 'updated_at'>[] = [
  // Grants
  { program_type: 'grant', name: 'IPO Patent Filing Grant', provider: 'UK Intellectual Property Office', description: 'SME grant support for first patent filing — up to £10,000 towards IP attorney fees and filing costs', status: 'researching', min_amount_pence: 100000, max_amount_pence: 1000000, deadline: null, url: 'https://www.gov.uk/get-help-ip', lead_contact: null, notes: 'Check IP Audits scheme and Patent Box combination' },
  { program_type: 'grant', name: 'Innovate UK IP-First Package', provider: 'Innovate UK', description: 'IP auditing and strategy grant for innovative SMEs — covers attorney costs and IP mapping', status: 'researching', min_amount_pence: 500000, max_amount_pence: 5000000, deadline: null, url: 'https://www.innovateukedge.ukri.org/', lead_contact: null, notes: 'Innovate UK Edge service provides free IP advice to grant recipients' },
  { program_type: 'grant', name: 'Knowledge Transfer Partnership (KTP)', provider: 'Innovate UK / UKRI', description: 'Collaborative programme to bring AI expertise into Flowen — KTPs can fund IP development work', status: 'researching', min_amount_pence: 5000000, max_amount_pence: 30000000, deadline: null, url: 'https://iuk.ktn-uk.org/ktp/', lead_contact: null, notes: 'Good vehicle for academic data partnership IP' },

  // Tax Relief
  { program_type: 'tax_relief', name: 'Patent Box Tax Relief', provider: 'HMRC', description: '10% corporation tax rate on profits from patented inventions — strong incentive to file patents', status: 'not_eligible', min_amount_pence: null, max_amount_pence: null, deadline: null, url: 'https://www.gov.uk/guidance/corporation-tax-the-patent-box', lead_contact: null, notes: 'Not yet eligible — milestone: first patent granted' },
  { program_type: 'tax_relief', name: 'R&D Tax Credits (RDEC)', provider: 'HMRC', description: 'Research & Development expenditure credit — 20% cash credit on qualifying R&D costs including AI model work', status: 'in_progress', min_amount_pence: null, max_amount_pence: null, deadline: null, url: 'https://www.gov.uk/guidance/corporation-tax-research-and-development-rd-relief', lead_contact: null, notes: 'ASR model development and training data creation should qualify' },
  { program_type: 'tax_relief', name: 'Creative Industries Tax Relief', provider: 'HMRC', description: 'Potential relief for software / interactive media elements of the platform', status: 'researching', min_amount_pence: null, max_amount_pence: null, deadline: null, url: 'https://www.gov.uk/guidance/corporation-tax-creative-industry-tax-reliefs', lead_contact: null, notes: 'Check eligibility with tax adviser — overlap with R&D' },

  // Loans
  { program_type: 'loan', name: 'IP-Backed Finance (Barclays Eagle Labs)', provider: 'Barclays / British Business Bank', description: 'Loans using IP portfolio as collateral — becoming more available to AI/software SMEs', status: 'researching', min_amount_pence: 5000000, max_amount_pence: 50000000, deadline: null, url: 'https://labs.barclays/', lead_contact: null, notes: 'Requires formalised IP register and valuations — Tier 1 audit prerequisite' },
  { program_type: 'loan', name: 'IP Finance Pilot (IPO / BBB)', provider: 'UK IPO & British Business Bank', description: 'Government-backed pilot for IP-secured lending to knowledge-intensive firms', status: 'researching', min_amount_pence: 2500000, max_amount_pence: 25000000, deadline: null, url: 'https://www.gov.uk/government/consultations/intangible-assets-and-financing', lead_contact: null, notes: 'Monitor for programme launch — very relevant for AI IP' },

  // Legal Aid / Support
  { program_type: 'legal_aid', name: 'IPO IP Audit & Health Check', provider: 'UK Intellectual Property Office', description: 'Free IP health check service — recommended starting point for structured IP audit', status: 'researching', min_amount_pence: null, max_amount_pence: null, deadline: null, url: 'https://www.gov.uk/check-if-your-invention-already-exists', lead_contact: null, notes: 'Can be done by phone or online — free resource' },
  { program_type: 'legal_aid', name: 'Innovate UK Edge IP Support', provider: 'Innovate UK Edge', description: 'Free specialist IP support for innovators — includes IP strategy, freedom-to-operate searches', status: 'eligible', min_amount_pence: null, max_amount_pence: null, deadline: null, url: 'https://www.innovateukedge.ukri.org/', lead_contact: null, notes: 'Eligibility: must have received or applied for Innovate UK funding' },

  // Licensing
  { program_type: 'licensing', name: 'NHS / ICB Technology Licensing', provider: 'NHS Integrated Care Boards', description: 'License the Flowen technology to NHS trusts via formal licensing — creates recurring revenue and strengthens IP position', status: 'researching', min_amount_pence: null, max_amount_pence: null, deadline: null, url: null, lead_contact: null, notes: 'Explore SBRI commercialisation route; strengthens IP on the clinical method' },
  { program_type: 'licensing', name: 'University Spin-Out / Research Partner', provider: 'Academic institution', description: 'Partner with a university speech science department to co-develop IP with joint ownership and access rights', status: 'researching', min_amount_pence: null, max_amount_pence: null, deadline: null, url: null, lead_contact: null, notes: 'Brings credibility + access to research datasets; negotiate IP split carefully' },

  // Equity
  { program_type: 'equity', name: 'SEIS Investment — IP Narrative', provider: 'Angel Investors (SEIS)', description: 'Frame the IP portfolio strength as a key SEIS/EIS investment narrative — proprietary AI + trademark = defensible moat', status: 'in_progress', min_amount_pence: null, max_amount_pence: null, deadline: null, url: null, lead_contact: null, notes: 'Advance assurance in review — IP audit completion strengthens pitch' },
];

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();

  const [auditRes, fundingRes] = await Promise.all([
    client.from('ip_audit_items').select('*').order('priority').order('created_at'),
    client.from('ip_funding_items').select('*').order('created_at'),
  ]);

  return NextResponse.json({
    auditItems:   auditRes.data   ?? [],
    fundingItems: fundingRes.data ?? [],
  });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const { action } = body;
  const client = db();
  const now = new Date().toISOString();

  // ── seed ─────────────────────────────────────────────────────────────────────

  if (action === 'seed') {
    const [{ count: ac }, { count: fc }] = await Promise.all([
      client.from('ip_audit_items').select('*', { count: 'exact', head: true }),
      client.from('ip_funding_items').select('*', { count: 'exact', head: true }),
    ]);
    if ((ac ?? 0) > 0 || (fc ?? 0) > 0) {
      // Already seeded — return existing
      const [ar, fr] = await Promise.all([
        client.from('ip_audit_items').select('*').order('priority').order('created_at'),
        client.from('ip_funding_items').select('*').order('created_at'),
      ]);
      return NextResponse.json({ auditItems: ar.data ?? [], fundingItems: fr.data ?? [] });
    }
    const [ae, fe] = await Promise.all([
      client.from('ip_audit_items').insert(SEED_AUDIT),
      client.from('ip_funding_items').insert(SEED_FUNDING),
    ]);
    if (ae.error || fe.error) {
      return NextResponse.json({ error: ae.error?.message ?? fe.error?.message }, { status: 400 });
    }
    const [ar, fr] = await Promise.all([
      client.from('ip_audit_items').select('*').order('priority').order('created_at'),
      client.from('ip_funding_items').select('*').order('created_at'),
    ]);
    return NextResponse.json({ auditItems: ar.data ?? [], fundingItems: fr.data ?? [] });
  }

  // ── audit: add ────────────────────────────────────────────────────────────────

  if (action === 'audit_add') {
    const { data, error } = await client
      .from('ip_audit_items')
      .insert({
        category:     body.category,
        title:        body.title,
        description:  body.description  ?? null,
        status:       body.status       ?? 'not_started',
        risk_level:   body.risk_level   ?? 'medium',
        priority:     body.priority     ?? 3,
        assignee:     body.assignee     ?? null,
        due_date:     body.due_date     ?? null,
        evidence_url: body.evidence_url ?? null,
        notes:        body.notes        ?? null,
      })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'ip_audit.add', resource_type: 'ip_audit_item', resource_id: data.id, metadata: { title: data.title }, severity: 'info' });
    return NextResponse.json({ item: data });
  }

  // ── audit: update ─────────────────────────────────────────────────────────────

  if (action === 'audit_update') {
    const { data, error } = await client
      .from('ip_audit_items')
      .update({
        category:     body.category,
        title:        body.title,
        description:  body.description  ?? null,
        status:       body.status,
        risk_level:   body.risk_level,
        priority:     body.priority,
        assignee:     body.assignee     ?? null,
        due_date:     body.due_date     ?? null,
        evidence_url: body.evidence_url ?? null,
        notes:        body.notes        ?? null,
        updated_at:   now,
      })
      .eq('id', body.id as string)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  // ── audit: delete ─────────────────────────────────────────────────────────────

  if (action === 'audit_delete') {
    const { error } = await client.from('ip_audit_items').delete().eq('id', body.id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // ── audit: quick status ───────────────────────────────────────────────────────

  if (action === 'audit_status') {
    const { data, error } = await client
      .from('ip_audit_items')
      .update({ status: body.status, updated_at: now })
      .eq('id', body.id as string)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  // ── funding: add ──────────────────────────────────────────────────────────────

  if (action === 'funding_add') {
    const { data, error } = await client
      .from('ip_funding_items')
      .insert({
        program_type:     body.program_type,
        name:             body.name,
        provider:         body.provider,
        description:      body.description      ?? null,
        status:           body.status           ?? 'researching',
        min_amount_pence: body.min_amount_pence ?? null,
        max_amount_pence: body.max_amount_pence ?? null,
        deadline:         body.deadline         ?? null,
        url:              body.url              ?? null,
        lead_contact:     body.lead_contact     ?? null,
        notes:            body.notes            ?? null,
      })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'ip_funding.add', resource_type: 'ip_funding_item', resource_id: data.id, metadata: { name: data.name }, severity: 'info' });
    return NextResponse.json({ item: data });
  }

  // ── funding: update ───────────────────────────────────────────────────────────

  if (action === 'funding_update') {
    const { data, error } = await client
      .from('ip_funding_items')
      .update({
        program_type:     body.program_type,
        name:             body.name,
        provider:         body.provider,
        description:      body.description      ?? null,
        status:           body.status,
        min_amount_pence: body.min_amount_pence ?? null,
        max_amount_pence: body.max_amount_pence ?? null,
        deadline:         body.deadline         ?? null,
        url:              body.url              ?? null,
        lead_contact:     body.lead_contact     ?? null,
        notes:            body.notes            ?? null,
        updated_at:       now,
      })
      .eq('id', body.id as string)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  // ── funding: delete ───────────────────────────────────────────────────────────

  if (action === 'funding_delete') {
    const { error } = await client.from('ip_funding_items').delete().eq('id', body.id as string);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // ── funding: quick status ─────────────────────────────────────────────────────

  if (action === 'funding_status') {
    const { data, error } = await client
      .from('ip_funding_items')
      .update({ status: body.status, updated_at: now })
      .eq('id', body.id as string)
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
