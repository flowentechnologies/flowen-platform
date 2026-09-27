// ── Live data for ip-docs whose facts have a real source of truth elsewhere
// in the platform (company_records, seis_eis_status) rather than being
// hand-copied into the document text — see SeisLiveData in content.tsx for
// what this feeds and why. Server-only.
import { adminDb } from '@/lib/supabase/admin';
import type { SeisLiveData } from './content';

const EMPTY: SeisLiveData = {
  utr: null,
  totalFte: null,
  grossAssetsPence: null,
  grossAssetsAsOf: null,
  priorEisVctInvestment: null,
  priorEisVctNotes: null,
};

export async function getSeisLiveData(): Promise<SeisLiveData> {
  const db = adminDb();

  const [recordsRes, statusRes] = await Promise.all([
    db
      .from('company_records')
      .select('value')
      .eq('entity', 'group')
      .eq('record_type', 'corporation_tax_utr')
      .maybeSingle(),
    db
      .from('seis_eis_status')
      .select('total_fte, consolidated_gross_assets_pence, prior_eis_vct_investment, prior_eis_vct_notes, updated_at')
      .limit(1)
      .maybeSingle(),
  ]);

  if (recordsRes.error) console.error('[ip-docs/live-data] company_records fetch failed:', recordsRes.error);
  if (statusRes.error) console.error('[ip-docs/live-data] seis_eis_status fetch failed:', statusRes.error);

  const status = statusRes.data;

  return {
    utr: recordsRes.data?.value ?? null,
    totalFte: status?.total_fte ?? null,
    grossAssetsPence: status?.consolidated_gross_assets_pence ?? null,
    grossAssetsAsOf: status?.consolidated_gross_assets_pence !== null && status?.consolidated_gross_assets_pence !== undefined && status?.updated_at
      ? new Date(status.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null,
    priorEisVctInvestment: status?.prior_eis_vct_investment ?? null,
    priorEisVctNotes: status?.prior_eis_vct_notes ?? null,
  };
}

export { EMPTY as EMPTY_SEIS_LIVE_DATA };
