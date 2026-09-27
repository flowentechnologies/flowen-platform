// ── Live data for ip-docs whose facts have a real source of truth elsewhere
// in the platform (Xero, company_records, seis_eis_status) rather than
// being hand-copied into the document text — see SeisLiveData in
// content.tsx for what this feeds and why. Server-only.
import { adminDb } from '@/lib/supabase/admin';
import { getBalanceSheet, findReportValue } from '@/lib/xero';
import { XERO_ENTITIES } from '@/lib/flowen-entities';
import type { SeisLiveData } from './content';

const EMPTY: SeisLiveData = {
  utr: null,
  totalFte: null,
  grossAssetsPence: null,
  grossAssetsAsOf: null,
  priorEisVctInvestment: null,
  priorEisVctNotes: null,
  founderShares: null,
  emiPoolShares: null,
  emiPoolSubdivisionConfirmed: false,
};

// Consolidated group gross assets, pulled live from each entity's Xero
// Balance Sheet — the same figure the SEIS letter's eligibility test needs,
// computed the same way /admin/bookkeeping/overview computes it, rather
// than from a value someone remembered to copy into seis_eis_status. Falls
// back to that stored snapshot (and flags it as such) if a live Xero call
// fails — e.g. a token needs reconnecting — so the letter degrades to a
// known-stale number instead of silently rendering a blank.
async function getLiveGrossAssetsPence(): Promise<{ pence: number | null; asOf: string | null; live: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const results = await Promise.allSettled(
      XERO_ENTITIES.map(({ slug }) => getBalanceSheet(slug, today)),
    );
    let total = 0;
    let anySucceeded = false;
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const assets = findReportValue(result.value, 'Total Assets');
      if (typeof assets === 'number') {
        total += assets;
        anySucceeded = true;
      }
    }
    if (!anySucceeded) return { pence: null, asOf: null, live: false };
    return {
      pence: Math.round(total * 100),
      asOf: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      live: true,
    };
  } catch (err) {
    console.error('[ip-docs/live-data] live Xero gross-assets pull failed:', err);
    return { pence: null, asOf: null, live: false };
  }
}

export async function getSeisLiveData(): Promise<SeisLiveData> {
  const db = adminDb();

  const [recordsRes, statusRes, capTableRes, liveAssets] = await Promise.all([
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
    db
      .from('cap_table_entries')
      .select('holder_type, instrument, shares'),
    getLiveGrossAssetsPence(),
  ]);

  if (recordsRes.error) console.error('[ip-docs/live-data] company_records fetch failed:', recordsRes.error);
  if (statusRes.error) console.error('[ip-docs/live-data] seis_eis_status fetch failed:', statusRes.error);
  if (capTableRes.error) console.error('[ip-docs/live-data] cap_table_entries fetch failed:', capTableRes.error);

  const status = statusRes.data;
  const capTable = capTableRes.data ?? [];
  const founderRow = capTable.find(r => r.holder_type === 'founder');
  const emiRow = capTable.find(r => r.instrument === 'emi_option');
  // Crude but reliable given today's known numbers: a genuinely post-
  // subdivision EMI pool would be in the hundreds of millions of shares —
  // anything still under a million means the 1,000:1 subdivision applied
  // to founder shares hasn't been carried across to the pool (or a decision
  // not to was never recorded), so flag it rather than silently assume.
  const emiPoolSubdivisionConfirmed = emiRow ? emiRow.shares >= 1_000_000 : false;

  // Prefer the live Xero pull; fall back to the last stored snapshot,
  // clearly labelled as such, if Xero couldn't be reached just now.
  const grossAssetsPence = liveAssets.live ? liveAssets.pence : (status?.consolidated_gross_assets_pence ?? null);
  const grossAssetsAsOf = liveAssets.live
    ? `${liveAssets.asOf} (live)`
    : status?.consolidated_gross_assets_pence !== null && status?.consolidated_gross_assets_pence !== undefined && status?.updated_at
      ? `${new Date(status.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (last known — live Xero pull failed just now, reconnect may be needed)`
      : null;

  return {
    utr: recordsRes.data?.value ?? null,
    totalFte: status?.total_fte ?? null,
    grossAssetsPence,
    grossAssetsAsOf,
    priorEisVctInvestment: status?.prior_eis_vct_investment ?? null,
    priorEisVctNotes: status?.prior_eis_vct_notes ?? null,
    founderShares: founderRow?.shares ?? null,
    emiPoolShares: emiRow?.shares ?? null,
    emiPoolSubdivisionConfirmed,
  };
}

export { EMPTY as EMPTY_SEIS_LIVE_DATA };
