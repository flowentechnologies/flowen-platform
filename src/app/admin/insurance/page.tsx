import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { InsuranceClient } from './InsuranceClient';

export const dynamic = 'force-dynamic';

export interface InsurancePolicyRow {
  id: string;
  policy_type: string;
  provider: string | null;
  policy_number: string | null;
  entity: string | null;
  coverage_amount_pence: number | null;
  start_date: string | null;
  end_date: string | null;
  document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const RECOMMENDED = [
  { type: 'Professional Indemnity', why: 'Standard requirement for any organisation offering clinical/therapeutic software — covers claims of professional negligence in the advice or tool provided.' },
  { type: 'Clinical Negligence', why: 'Given Flowen is positioned as a clinical tool (DCB0129, DTAC), NHS/institutional procurement will expect this alongside professional indemnity.' },
  { type: 'Cyber Insurance', why: 'Covers breach response, notification costs, and business interruption if special-category health/biometric data is ever compromised.' },
  { type: 'Public/Products Liability', why: 'Common baseline requirement in most commercial and institutional contracts.' },
];

// Pulled out of the component body — computing "today" is a genuinely
// impure operation (depends on when the page happens to render), so it
// belongs in a plain helper the component calls, not inline in its render.
function splitByExpiry(items: InsurancePolicyRow[], nowMs: number) {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const sixtyDaysOut = new Date(nowMs + 60 * 86_400_000).toISOString().slice(0, 10);
  return {
    expiringSoon: items.filter(i => i.end_date && i.end_date > today && i.end_date < sixtyDaysOut),
    expired: items.filter(i => i.end_date && i.end_date < today),
  };
}

export default async function InsurancePage() {
  await assertAdmin();

  const { data } = await adminDb()
    .from('insurance_policies')
    .select('*')
    .order('end_date', { ascending: true, nullsFirst: false });

  const items = (data ?? []) as InsurancePolicyRow[];
  const { expiringSoon, expired } = splitByExpiry(items, Date.now());

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Insurance</h1>
          <p className="text-slate-400 text-sm mt-1">Policy register — coverage, provider, and renewal dates for the group.</p>
        </div>
        <span className={`self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
          items.length === 0
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            : expired.length > 0
              ? 'bg-red-500/10 text-red-400 border-red-500/30'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        }`}>
          {items.length === 0 ? 'NO POLICIES ON FILE' : `${items.length} POLIC${items.length === 1 ? 'Y' : 'IES'}`}
        </span>
      </div>

      {items.length === 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
          <p className="text-sm font-bold text-amber-500 mb-1">Nothing on file yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            No insurance policy has ever been recorded for the group. NHS trusts, ICBs, and most institutional
            customers will ask for evidence of the policies below as standard due diligence before contracting —
            worth having in place before it blocks a procurement conversation, not after.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RECOMMENDED.map(r => (
              <div key={r.type} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{r.type}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{r.why}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {expired.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm font-bold text-red-400">{expired.length} polic{expired.length === 1 ? 'y has' : 'ies have'} expired</p>
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-500">{expiringSoon.length} polic{expiringSoon.length === 1 ? 'y expires' : 'ies expire'} within 60 days</p>
        </div>
      )}

      <InsuranceClient initialItems={items} />
    </div>
  );
}
