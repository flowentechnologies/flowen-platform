/**
 * POST /api/admin/bookkeeping/ask
 *
 * General Q&A on demand — "what's our burn this month", "any unreconciled
 * transactions", "any duplicate bills" — answered from a live snapshot of
 * Xero + local bookkeeping data. Read-only: this route never writes
 * anything anywhere, unlike every other bookkeeping route in this
 * codebase. No drafts, no approval flow needed, because there's nothing to
 * approve.
 *
 * The system prompt is explicit that the model must answer only from the
 * data handed to it and say so plainly when the data can't answer the
 * question, rather than inventing a figure — same discipline as
 * generateReplyDraft() and the investor-update prompt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';
import {
  getStoredXeroTokens, listRecentInvoices, listRecentBankTransactions, listChartOfAccounts,
} from '@/lib/xero';
import { findDuplicateVendorInvoices } from '@/lib/bookkeeping-duplicates';

const SYSTEM_PROMPT = `You are a bookkeeping assistant for Flowen Group Limited, answering a founder's question about their finances from the data snapshot below.

Answer ONLY from the data provided. If the data doesn't contain what's needed to answer confidently, say so plainly and name what's missing (e.g. "Xero isn't connected yet" or "no bank transactions in this snapshot") rather than guessing or inventing a figure. Never state a balance, total, or count that isn't directly computable from the data given.

Be concise and concrete — lead with the number or the direct answer, then a sentence of context if useful. This is a one-off answer, not a report.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const missingKey = requireAnthropicKey();
  if (missingKey) return missingKey;

  const body = await req.json() as { question?: string };
  if (!body.question?.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const xeroTokens = await getStoredXeroTokens();
  const xeroConnected = Boolean(xeroTokens?.tenant_id);

  const sections: string[] = [];

  if (xeroConnected) {
    try {
      const [invoices, bankTransactions, accounts] = await Promise.all([
        listRecentInvoices(50),
        listRecentBankTransactions(50),
        listChartOfAccounts(),
      ]);

      sections.push(`XERO ORGANISATION: ${xeroTokens!.tenant_name ?? xeroTokens!.tenant_id}`);

      sections.push(`RECENT INVOICES (${invoices.length}, newest first):\n` + (invoices.length === 0 ? '(none)' : invoices.map(inv =>
        `- ${inv.Type} ${inv.Status} ${inv.Date} ${inv.Contact?.Name ?? 'unknown contact'} — ${inv.Total} (ref: ${inv.Reference ?? 'none'})`,
      ).join('\n')));

      const unreconciled = bankTransactions.filter(t => !t.IsReconciled);
      const uncoded = bankTransactions.filter(t => t.LineItems.every(li => !li.AccountCode));
      sections.push(`RECENT BANK TRANSACTIONS (${bankTransactions.length} fetched, ${unreconciled.length} unreconciled, ${uncoded.length} uncoded):\n` + (bankTransactions.length === 0 ? '(none)' : bankTransactions.slice(0, 30).map(t =>
        `- ${t.Type} ${t.Date} ${t.Contact?.Name ?? 'unknown'} — ${t.Total} — ${t.IsReconciled ? 'reconciled' : 'UNRECONCILED'} — ${t.LineItems[0]?.AccountCode ? `coded ${t.LineItems[0].AccountCode}` : 'UNCODED'}`,
      ).join('\n')));

      sections.push(`CHART OF ACCOUNTS: ${accounts.length} active accounts (${accounts.filter(a => a.Class === 'EXPENSE').length} expense, ${accounts.filter(a => a.Class === 'REVENUE').length} revenue)`);
    } catch (err) {
      sections.push(`XERO: connected but a live fetch failed just now (${err instanceof Error ? err.message : 'unknown error'}) — answer only from the local data below.`);
    }
  } else {
    sections.push('XERO: not connected. No live invoice, bank transaction, or chart-of-accounts data is available — only the locally-captured data below.');
  }

  const { data: recentVendorInvoices } = await db()
    .from('vendor_invoices')
    .select('vendor_name, amount_pence, currency, description, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  sections.push(`LOCALLY CAPTURED VENDOR INVOICES (from email, ${recentVendorInvoices?.length ?? 0} most recent):\n` + (!recentVendorInvoices?.length ? '(none)' : recentVendorInvoices.map(v =>
    `- ${v.vendor_name ?? 'unknown'} — ${v.amount_pence != null ? `${(v.amount_pence / 100).toFixed(2)} ${v.currency}` : 'amount unknown'} — ${v.description ?? ''} (${v.created_at})`,
  ).join('\n')));

  const duplicates = await findDuplicateVendorInvoices();
  sections.push(`POTENTIAL DUPLICATE VENDOR INVOICES (same vendor + amount + currency appearing more than once): ${duplicates.length === 0 ? 'none found' : duplicates.map(d =>
    `${d.vendorName ?? 'unknown'} ${(d.amountPence / 100).toFixed(2)} ${d.currency} — appears ${d.count} times`,
  ).join('; ')}`);

  const { data: draftCounts } = await db()
    .from('bookkeeping_drafts')
    .select('draft_type, status');
  const pendingByType: Record<string, number> = {};
  for (const row of (draftCounts ?? []) as { draft_type: string; status: string }[]) {
    if (row.status === 'pending') pendingByType[row.draft_type] = (pendingByType[row.draft_type] ?? 0) + 1;
  }
  sections.push(`PENDING BOOKKEEPING DRAFTS AWAITING APPROVAL: ${Object.keys(pendingByType).length === 0 ? 'none' : Object.entries(pendingByType).map(([t, n]) => `${n} ${t}`).join(', ')}`);

  const dataAsOf = new Date().toISOString();
  const userPrompt = `Data snapshot as of ${dataAsOf}:\n\n${sections.join('\n\n')}\n\nQuestion: ${body.question}`;

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const textBlock = msg.content.find(b => b.type === 'text');
    const answer = textBlock && textBlock.type === 'text' ? textBlock.text : 'No answer generated.';

    return NextResponse.json({ answer, dataAsOf, xeroConnected });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ask failed' }, { status: 500 });
  }
}
