/**
 * POST /api/admin/bookkeeping/ask
 *
 * General Q&A on demand — "what's our burn this month", "any unreconciled
 * transactions", "any duplicate bills" — answered from a live snapshot of
 * Xero + local bookkeeping data across every connected Flowen group entity
 * (src/lib/flowen-entities.ts). Read-only: this route never writes
 * anything anywhere, unlike every other bookkeeping route in this
 * codebase. No drafts, no approval flow needed, because there's nothing to
 * approve.
 *
 * The system prompt is explicit that the model must answer only from the
 * data handed to it and say so plainly when the data can't answer the
 * question, rather than inventing a figure — same discipline as
 * generateReplyDraft() and the investor-update prompt. Each entity's Xero
 * data is clearly labelled in its own section so the model (and the founder
 * reading the answer) never conflates one company's numbers with another's.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';
import {
  getAllXeroTokens, listRecentInvoices, listRecentBankTransactions, listChartOfAccounts,
} from '@/lib/xero';
import { XERO_ENTITIES, entityName, type XeroEntitySlug } from '@/lib/flowen-entities';
import { findDuplicateVendorInvoices } from '@/lib/bookkeeping-duplicates';

const SYSTEM_PROMPT = `You are a bookkeeping assistant for the Flowen group (4 companies: Flowen Group Ltd, Flowen IP Ltd, Flowen Speech Technologies Ltd, Flowen Labs Ltd), answering a founder's question about their finances from the data snapshot below. The snapshot has one section per connected entity — always say which entity a figure belongs to, never merge numbers across entities unless the question explicitly asks for a group total.

Answer ONLY from the data provided. If the data doesn't contain what's needed to answer confidently, say so plainly and name what's missing (e.g. "Xero isn't connected for Flowen Labs yet" or "no bank transactions in this snapshot") rather than guessing or inventing a figure. Never state a balance, total, or count that isn't directly computable from the data given.

Be concise and concrete — lead with the number or the direct answer, then a sentence of context if useful. This is a one-off answer, not a report.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const missingKey = requireAnthropicKey();
  if (missingKey) return missingKey;

  const body = await req.json() as { question?: string };
  if (!body.question?.trim()) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  const allTokens = await getAllXeroTokens();
  const connectedTokens = allTokens.filter(t => t.tenant_id);
  const xeroConnected = connectedTokens.length > 0;

  const sections: string[] = [];

  if (xeroConnected) {
    for (const token of connectedTokens) {
      const entity = token.entity;
      const label = `${entityName(entity)} (${token.tenant_name ?? token.tenant_id})`;
      try {
        const [invoices, bankTransactions, accounts] = await Promise.all([
          listRecentInvoices(entity, 50),
          listRecentBankTransactions(entity, 50),
          listChartOfAccounts(entity),
        ]);

        sections.push(`── ${label} ──`);

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
        sections.push(`── ${label} ──\nA live fetch failed just now (${err instanceof Error ? err.message : 'unknown error'}) — answer only from the local data below for this entity.`);
      }
    }
  } else {
    sections.push('XERO: not connected for any Flowen group entity. No live invoice, bank transaction, or chart-of-accounts data is available — only the locally-captured data below.');
  }

  const connectedSlugs = new Set(connectedTokens.map(t => t.entity));
  const notConnected = XERO_ENTITIES.filter(e => !connectedSlugs.has(e.slug)).map(e => e.name);
  if (notConnected.length > 0) {
    sections.push(`XERO NOT CONNECTED for: ${notConnected.join(', ')} — no live data available for these entities, only what's captured locally below.`);
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
    .select('draft_type, status, entity');
  const pendingByTypeAndEntity: Record<string, number> = {};
  for (const row of (draftCounts ?? []) as { draft_type: string; status: string; entity: string }[]) {
    if (row.status !== 'pending') continue;
    const key = `${row.draft_type} (${entityName(row.entity as XeroEntitySlug)})`;
    pendingByTypeAndEntity[key] = (pendingByTypeAndEntity[key] ?? 0) + 1;
  }
  sections.push(`PENDING BOOKKEEPING DRAFTS AWAITING APPROVAL: ${Object.keys(pendingByTypeAndEntity).length === 0 ? 'none' : Object.entries(pendingByTypeAndEntity).map(([t, n]) => `${n} ${t}`).join(', ')}`);

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
