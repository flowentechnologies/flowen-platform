/**
 * bookkeeping-expense-from-email
 *
 * Proposes a bookkeeping_drafts row (draft_type='expense_from_email') for
 * every vendor_invoices row that has a real amount and doesn't already have
 * a draft — the "expenses captured from vendor email" capability. Reuses
 * the exact same AI categorisation call as bookkeeping-categorize
 * (suggestCategory(), src/lib/bookkeeping-categorize.ts) to suggest an
 * expense account code, since it's the same kind of judgement call — "which
 * chart-of-accounts code does this spend belong to" — just starting from an
 * email-derived vendor invoice instead of a bank feed line.
 *
 * vendor_invoices itself is populated continuously by gmail-sync
 * (src/app/api/cron/gmail-sync/route.ts) whenever it classifies an inbound
 * email as billing — this cron only ever reads that table, never Gmail
 * directly. gmail-sync only scans mail from the last 2 days
 * (listRecentMessageIds), so this does NOT yet cover older mail already
 * sitting in the inbox before that window — a one-off backfill pass over
 * historical mail is separate, deliberately out-of-scope follow-up work.
 *
 * vendor_invoices has no per-entity attribution yet — gmail-sync doesn't
 * know which of the 4 Flowen group companies (src/lib/flowen-entities.ts) a
 * captured vendor email belongs to, and a lot of shared-service vendors are
 * deliberately contracted at the Group level anyway (one engagement covering
 * all subsidiaries). So — like bookkeeping-stripe-sync — this books every
 * captured bill against a single configured entity
 * (XERO_EXPENSE_FROM_EMAIL_ENTITY, defaulting to 'group') rather than
 * looping over all connected entities, which would multiply-propose the same
 * one real bill once per entity. Once vendor_invoices carries its own entity
 * attribution (e.g. from which @flowen.digital alias received the email),
 * switch this to read that instead of a single fixed entity.
 *
 * A vendor_invoices row with no extracted amount (amount_pence null — the
 * extraction in extractAmountPence() is best-effort and doesn't always find
 * one) is skipped rather than proposing a bill with an invented amount.
 *
 * Skips cleanly (ok:true, skipped:true) if that entity doesn't have Xero
 * connected yet — see /admin/bookkeeping.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logging';
import { adminDb as db } from '@/lib/supabase/admin';
import { getValidXeroAccess, listChartOfAccounts } from '@/lib/xero';
import { suggestCategory } from '@/lib/bookkeeping-categorize';
import { isXeroEntitySlug, type XeroEntitySlug } from '@/lib/flowen-entities';
import { verifyCronRequest } from '@/lib/cron-auth';

const MAX_PER_RUN = 25;
const DEFAULT_ENTITY: XeroEntitySlug = 'group';

interface VendorInvoiceRow {
  id: string;
  vendor_name: string | null;
  amount_pence: number | null;
  currency: string | null;
  description: string | null;
  invoice_date: string | null;
  created_at: string;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configuredEntity = process.env.XERO_EXPENSE_FROM_EMAIL_ENTITY;
  const entity: XeroEntitySlug = configuredEntity && isXeroEntitySlug(configuredEntity) ? configuredEntity : DEFAULT_ENTITY;

  const xeroAccess = await getValidXeroAccess(entity);
  if (!xeroAccess) {
    return NextResponse.json({ ok: true, skipped: true, reason: `Xero not connected for ${entity} — visit /admin/bookkeeping` });
  }

  const supabase = db();
  const { data: invoices, error: fetchErr } = await supabase
    .from('vendor_invoices')
    .select('id, vendor_name, amount_pence, currency, description, invoice_date, created_at')
    .not('amount_pence', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (fetchErr) throw new Error(fetchErr.message);

  const expenseAccounts = (await listChartOfAccounts(entity)).filter(a => a.Class === 'EXPENSE');

  let proposed = 0;
  let skippedExistingDraft = 0;
  let skippedNoSuggestion = 0;
  let processed = 0;
  const errors: { vendorInvoiceId: string; error: string }[] = [];

  for (const invoice of (invoices ?? []) as VendorInvoiceRow[]) {
    if (processed >= MAX_PER_RUN) break;

    try {
      const { data: existingDraft } = await supabase
        .from('bookkeeping_drafts')
        .select('id')
        .eq('draft_type', 'expense_from_email')
        .eq('source_ref', invoice.id)
        .eq('entity', entity)
        .neq('status', 'rejected')
        .maybeSingle();
      if (existingDraft) { skippedExistingDraft++; continue; }

      processed++;
      const contactName = invoice.vendor_name ?? 'Unknown vendor';
      const description = invoice.description ?? 'Vendor invoice captured from email';
      const amount = invoice.amount_pence! / 100;
      const date = (invoice.invoice_date ?? invoice.created_at).slice(0, 10);

      const suggestion = await suggestCategory({
        description,
        contactName,
        amount,
        type: 'SPEND',
        accounts: expenseAccounts,
      });
      if (!suggestion) { skippedNoSuggestion++; continue; }

      const { error: insertErr } = await supabase.from('bookkeeping_drafts').insert({
        draft_type: 'expense_from_email',
        entity,
        source_ref: invoice.id,
        title: `${contactName} — ${(invoice.currency ?? 'gbp').toUpperCase()} ${amount.toFixed(2)} → ${suggestion.accountName}`,
        summary: suggestion.reasoning || `Bill captured from vendor email: ${description}`,
        proposed_payload: {
          contactName,
          reference: invoice.id,
          description,
          amount,
          currency: invoice.currency ?? 'gbp',
          accountCode: suggestion.accountCode,
          accountName: suggestion.accountName,
          date,
        },
        confidence_pct: suggestion.confidence,
        model: 'claude-sonnet-4-6',
      });
      if (insertErr) throw new Error(insertErr.message);
      proposed++;
    } catch (err) {
      errors.push({ vendorInvoiceId: invoice.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    entity,
    checked: invoices?.length ?? 0,
    proposed,
    skipped_existing_draft: skippedExistingDraft,
    skipped_no_suggestion: skippedNoSuggestion,
    errors,
  });
}

export const GET = withCronLogging('bookkeeping-expense-from-email', handle);
export const POST = withCronLogging('bookkeeping-expense-from-email', handle);
