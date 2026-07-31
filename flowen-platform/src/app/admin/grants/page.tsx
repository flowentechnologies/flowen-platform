import { assertAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { GrantsClient } from './GrantsClient';
import type { Grant } from '@/app/api/admin/grants/route';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function fetchGrants(): Promise<Grant[]> {
  const client = db();
  const { data, error } = await client
    .from('grants')
    .select('*')
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Grant[];
}

async function seedIfEmpty(grants: Grant[]): Promise<Grant[]> {
  if (grants.length > 0) return grants;

  const client = db();

  const SEED = [
    {
      name:             'SBRI Healthcare Phase 1',
      funder:           'NHS England / SBRI Healthcare',
      grant_type:       'sbri',
      amount_pence:     10_000_000,
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
      amount_pence:     50_000_000,
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
      amount_pence:     100_000_000,
      awarded_pence:    null,
      status:           'researching',
      deadline:         '2026-12-01',
      submitted_at:     null,
      decision_date:    null,
      lead_contact:     null,
      reference_number: null,
      notes:            'Invention for Innovation programme. Requires clinical partner letter.',
    },
    {
      name:             'SEIS Advance Assurance',
      funder:           'HMRC',
      grant_type:       'seis_eis',
      amount_pence:     25_000_000,
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
      amount_pence:     25_000_000,
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
      amount_pence:     15_000_000,
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

  const { data } = await client.from('grants').insert(SEED).select();
  return (data ?? []) as Grant[];
}

export default async function GrantsPage() {
  await assertAdmin();

  let grants = await fetchGrants();
  grants = await seedIfEmpty(grants);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Grants &amp; Funding</h1>
        <p className="text-sm text-slate-500 font-mono mt-1">Non-dilutive pipeline — Innovate UK, SBRI, NIHR &amp; more</p>
      </div>
      <GrantsClient initialGrants={grants} />
    </div>
  );
}
