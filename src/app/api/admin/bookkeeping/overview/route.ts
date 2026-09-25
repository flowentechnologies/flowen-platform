/**
 * GET /api/admin/bookkeeping/overview
 *
 * A consolidated, group-wide financial snapshot across every connected
 * Flowen entity — the "how is the whole group doing" view that no single
 * entity's Xero can answer on its own. Read-only, same as
 * /api/admin/bookkeeping/ask; this route never writes anything.
 *
 * Sources real Xero reports (Profit & Loss for the current UK tax year to
 * date, Balance Sheet as at today) via accounting.reports.profitandloss.read
 * and accounting.reports.balancesheet.read — an earlier version of this
 * route approximated revenue/expenses from raw invoice lists because those
 * scopes weren't connected yet; this is the real thing now. It still does
 * NOT eliminate intercompany transactions (e.g. Group funding a subsidiary
 * shows as an expense in one entity and income in another) — the
 * consolidated totals are a simple sum across entities, not a true
 * consolidation, and the UI says so rather than implying otherwise.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import {
  listConnectedXeroEntities, getStoredXeroTokens,
  getProfitAndLoss, getBalanceSheet, findReportValue,
  listRecentBankTransactions, listChartOfAccounts,
} from '@/lib/xero';
import { XERO_ENTITIES, type XeroEntitySlug } from '@/lib/flowen-entities';

interface EntityOverview {
  slug: XeroEntitySlug;
  name: string;
  tenantName: string | null;
  currency: string | null;
  revenue: number;
  expenses: number;
  net: number;
  totalAssets: number | null;
  totalLiabilities: number | null;
  netAssets: number | null;
  bankTransactionsFetched: number;
  unreconciledCount: number;
  uncodedCount: number;
  activeAccountCount: number;
  pendingDrafts: number;
  error: string | null;
}

// UK tax year to date — a defensible, standard period for a P&L snapshot
// rather than an arbitrary lookback window.
function currentTaxYearStart(today: Date): string {
  const aprilSixThisYear = new Date(Date.UTC(today.getUTCFullYear(), 3, 6));
  const start = today >= aprilSixThisYear
    ? aprilSixThisYear
    : new Date(Date.UTC(today.getUTCFullYear() - 1, 3, 6));
  return start.toISOString().slice(0, 10);
}

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const supabase = db();
  const connected = await listConnectedXeroEntities();

  const { data: draftRows } = await supabase
    .from('bookkeeping_drafts')
    .select('entity, status');
  const pendingByEntity: Record<string, number> = {};
  for (const row of (draftRows ?? []) as { entity: string; status: string }[]) {
    if (row.status === 'pending') pendingByEntity[row.entity] = (pendingByEntity[row.entity] ?? 0) + 1;
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const taxYearStart = currentTaxYearStart(today);

  const entities: EntityOverview[] = [];

  for (const { slug, name } of XERO_ENTITIES) {
    if (!connected.includes(slug)) {
      entities.push({
        slug, name, tenantName: null, currency: null,
        revenue: 0, expenses: 0, net: 0,
        totalAssets: null, totalLiabilities: null, netAssets: null,
        bankTransactionsFetched: 0, unreconciledCount: 0, uncodedCount: 0,
        activeAccountCount: 0, pendingDrafts: pendingByEntity[slug] ?? 0,
        error: 'Not connected',
      });
      continue;
    }

    try {
      const [tokenRow, plRows, bsRows, bankTransactions, accounts] = await Promise.all([
        getStoredXeroTokens(slug),
        getProfitAndLoss(slug, taxYearStart, todayStr),
        getBalanceSheet(slug, todayStr),
        listRecentBankTransactions(slug, 100),
        listChartOfAccounts(slug),
      ]);

      const revenue = findReportValue(plRows, 'total income') ?? findReportValue(plRows, 'total revenue') ?? 0;
      const expenses = findReportValue(plRows, 'total operating expenses') ?? findReportValue(plRows, 'total expenses') ?? 0;
      const net = findReportValue(plRows, 'net profit') ?? (revenue - expenses);
      const totalAssets = findReportValue(bsRows, 'total assets');
      const totalLiabilities = findReportValue(bsRows, 'total liabilities');
      const netAssets = findReportValue(bsRows, 'net assets') ?? (totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null);

      entities.push({
        slug, name,
        tenantName: tokenRow?.tenant_name ?? null,
        currency: 'GBP', // every connected entity is a UK company on GBP-denominated Xero orgs
        revenue, expenses, net,
        totalAssets, totalLiabilities, netAssets,
        bankTransactionsFetched: bankTransactions.length,
        unreconciledCount: bankTransactions.filter(t => !t.IsReconciled).length,
        uncodedCount: bankTransactions.filter(t => t.LineItems.every(li => !li.AccountCode)).length,
        activeAccountCount: accounts.length,
        pendingDrafts: pendingByEntity[slug] ?? 0,
        error: null,
      });
    } catch (err) {
      entities.push({
        slug, name, tenantName: null, currency: null,
        revenue: 0, expenses: 0, net: 0,
        totalAssets: null, totalLiabilities: null, netAssets: null,
        bankTransactionsFetched: 0, unreconciledCount: 0, uncodedCount: 0,
        activeAccountCount: 0, pendingDrafts: pendingByEntity[slug] ?? 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const totals = entities.reduce((acc, e) => ({
    revenue: acc.revenue + e.revenue,
    expenses: acc.expenses + e.expenses,
    net: acc.net + e.net,
    totalAssets: acc.totalAssets + (e.totalAssets ?? 0),
    totalLiabilities: acc.totalLiabilities + (e.totalLiabilities ?? 0),
    netAssets: acc.netAssets + (e.netAssets ?? 0),
    pendingDrafts: acc.pendingDrafts + e.pendingDrafts,
    unreconciledCount: acc.unreconciledCount + e.unreconciledCount,
    uncodedCount: acc.uncodedCount + e.uncodedCount,
  }), { revenue: 0, expenses: 0, net: 0, totalAssets: 0, totalLiabilities: 0, netAssets: 0, pendingDrafts: 0, unreconciledCount: 0, uncodedCount: 0 });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    periodStart: taxYearStart,
    periodEnd: todayStr,
    connectedCount: connected.length,
    totalEntities: XERO_ENTITIES.length,
    totals,
    entities,
  });
}
