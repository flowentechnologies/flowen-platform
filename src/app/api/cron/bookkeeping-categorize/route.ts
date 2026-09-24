/**
 * bookkeeping-categorize
 *
 * Proposes a bookkeeping_drafts row (draft_type='categorize') for every
 * uncoded, unreconciled Xero bank transaction — the "categorise bank
 * transactions" capability — across every Flowen group entity that has Xero
 * connected (src/lib/flowen-entities.ts; each of the 4 companies is its own
 * Xero organisation with its own bank feed, so this runs the same pass once
 * per connected entity rather than assuming a single organisation). Unlike
 * bookkeeping-stripe-sync this genuinely needs judgement, so each candidate
 * gets one Claude call (suggestCategory(), src/lib/bookkeeping-categorize.ts)
 * to pick an account code from that entity's own chart of accounts. A
 * hallucinated code is rejected before it can even become a draft — see that
 * file.
 *
 * "Uncoded" here means every line item on the transaction has no
 * AccountCode at all — Xero's /BankTransactions endpoint can also return
 * transactions that already have a code but haven't been reconciled to a
 * bank statement line yet, which this deliberately leaves alone (nothing
 * to suggest there). Bounded to MAX_PER_RUN per entity per invocation to cap
 * LLM spend per run rather than categorising an entire backlog in one go.
 *
 * Skips cleanly (ok:true, skipped:true) if no entity has Xero connected yet
 * — see /admin/bookkeeping.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logging';
import { adminDb as db } from '@/lib/supabase/admin';
import { listConnectedXeroEntities, listUnreconciledBankTransactions, listChartOfAccounts } from '@/lib/xero';
import { suggestCategory } from '@/lib/bookkeeping-categorize';
import type { XeroEntitySlug } from '@/lib/flowen-entities';

const MAX_PER_RUN = 25;

async function handle(_req: NextRequest): Promise<NextResponse> {
  const entities = await listConnectedXeroEntities();
  if (entities.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No Xero entity connected — visit /admin/bookkeeping' });
  }

  const supabase = db();
  const results: Record<string, unknown>[] = [];

  for (const entity of entities) {
    results.push(await categorizeForEntity(entity, supabase));
  }

  return NextResponse.json({
    ok: results.every(r => (r.errors as unknown[]).length === 0),
    entities: results,
  });
}

async function categorizeForEntity(entity: XeroEntitySlug, supabase: ReturnType<typeof db>): Promise<Record<string, unknown>> {
  const [transactions, allAccounts] = await Promise.all([
    listUnreconciledBankTransactions(entity),
    listChartOfAccounts(entity),
  ]);
  const categorizableAccounts = allAccounts.filter(a => a.Class === 'EXPENSE' || a.Class === 'REVENUE');

  let proposed = 0;
  let skippedExistingDraft = 0;
  let skippedAlreadyCoded = 0;
  let skippedNoSuggestion = 0;
  let processed = 0;
  const errors: { bankTransactionId: string; error: string }[] = [];

  for (const txn of transactions) {
    if (processed >= MAX_PER_RUN) break;

    if (txn.LineItems.some(li => li.AccountCode)) {
      skippedAlreadyCoded++;
      continue;
    }

    try {
      const { data: existingDraft } = await supabase
        .from('bookkeeping_drafts')
        .select('id')
        .eq('draft_type', 'categorize')
        .eq('source_ref', txn.BankTransactionID)
        .eq('entity', entity)
        .neq('status', 'rejected')
        .maybeSingle();
      if (existingDraft) { skippedExistingDraft++; continue; }

      processed++;
      const description = txn.LineItems.map(li => li.Description).filter(Boolean).join('; ') || txn.Reference || 'Bank transaction';

      const suggestion = await suggestCategory({
        description,
        contactName: txn.Contact?.Name,
        amount: txn.Total,
        type: txn.Type,
        accounts: categorizableAccounts,
      });
      if (!suggestion) { skippedNoSuggestion++; continue; }

      const { error: insertErr } = await supabase.from('bookkeeping_drafts').insert({
        draft_type: 'categorize',
        entity,
        source_ref: txn.BankTransactionID,
        title: `${txn.Contact?.Name ?? 'Unknown payee'} — ${txn.Total.toFixed(2)} → ${suggestion.accountName}`,
        summary: suggestion.reasoning || `Suggested category for: ${description}`,
        proposed_payload: {
          bankTransactionId: txn.BankTransactionID,
          description,
          contactName: txn.Contact?.Name ?? null,
          amount: txn.Total,
          date: txn.Date,
          accountCode: suggestion.accountCode,
          accountName: suggestion.accountName,
        },
        confidence_pct: suggestion.confidence,
        model: 'claude-sonnet-4-6',
      });
      if (insertErr) throw new Error(insertErr.message);
      proposed++;
    } catch (err) {
      errors.push({ bankTransactionId: txn.BankTransactionID, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    entity,
    checked: transactions.length,
    proposed,
    skipped_existing_draft: skippedExistingDraft,
    skipped_already_coded: skippedAlreadyCoded,
    skipped_no_suggestion: skippedNoSuggestion,
    errors,
  };
}

export const GET = withCronLogging('bookkeeping-categorize', handle);
export const POST = withCronLogging('bookkeeping-categorize', handle);
