/**
 * GET /api/admin/bookkeeping/overview
 *
 * A consolidated, group-wide financial snapshot across every connected
 * Flowen entity — the "how is the whole group doing" view that no single
 * entity's Xero can answer on its own. Read-only, same as
 * /api/admin/bookkeeping/ask; this route never writes anything.
 *
 * IMPORTANT — what this is and isn't: without the accounting.reports.read
 * scope (a separate, Advanced-tier-gated Xero permission we don't hold),
 * there's no access to Xero's actual Profit & Loss or Balance Sheet
 * reports. Revenue/expense figures here are computed from each entity's
 * most recent invoices (ACCREC = revenue, ACCPAY = expenses, AUTHORISED or
 * PAID only) — a real but partial signal, not an accrual-accounting P&L.
 * It also does NOT eliminate intercompany transactions (e.g. Group funding
 * a subsidiary would show as expense in one entity and revenue in
 * another) — the consolidated totals are a simple sum across entities, not
 * a true consolidation, and the UI says so rather than implying otherwise.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import {
  listConnectedXeroEntities, getStoredXeroTokens,
  listRecentInvoices, listRecentBankTransactions, listChartOfAccounts,
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
  invoicesConsidered: number;
  bankTransactionsFetched: number;
  unreconciledCount: number;
  uncodedCount: number;
  activeAccountCount: number;
  pendingDrafts: number;
  error: string | null;
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

  const entities: EntityOverview[] = [];

  for (const { slug, name } of XERO_ENTITIES) {
    if (!connected.includes(slug)) {
      entities.push({
        slug, name, tenantName: null, currency: null,
        revenue: 0, expenses: 0, net: 0, invoicesConsidered: 0,
        bankTransactionsFetched: 0, unreconciledCount: 0, uncodedCount: 0,
        activeAccountCount: 0, pendingDrafts: pendingByEntity[slug] ?? 0,
        error: 'Not connected',
      });
      continue;
    }

    try {
      const [tokenRow, invoices, bankTransactions, accounts] = await Promise.all([
        getStoredXeroTokens(slug),
        listRecentInvoices(slug, 100),
        listRecentBankTransactions(slug, 100),
        listChartOfAccounts(slug),
      ]);

      const counted = invoices.filter(inv => inv.Status === 'AUTHORISED' || inv.Status === 'PAID');
      const revenue = counted.filter(inv => inv.Type === 'ACCREC').reduce((sum, inv) => sum + inv.Total, 0);
      const expenses = counted.filter(inv => inv.Type === 'ACCPAY').reduce((sum, inv) => sum + inv.Total, 0);

      entities.push({
        slug, name,
        tenantName: tokenRow?.tenant_name ?? null,
        currency: 'GBP', // every connected entity is a UK company on GBP-denominated Xero orgs
        revenue, expenses, net: revenue - expenses,
        invoicesConsidered: counted.length,
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
        revenue: 0, expenses: 0, net: 0, invoicesConsidered: 0,
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
    pendingDrafts: acc.pendingDrafts + e.pendingDrafts,
    unreconciledCount: acc.unreconciledCount + e.unreconciledCount,
    uncodedCount: acc.uncodedCount + e.uncodedCount,
  }), { revenue: 0, expenses: 0, net: 0, pendingDrafts: 0, unreconciledCount: 0, uncodedCount: 0 });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    connectedCount: connected.length,
    totalEntities: XERO_ENTITIES.length,
    totals,
    entities,
  });
}
