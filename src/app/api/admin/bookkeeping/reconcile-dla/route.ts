/**
 * POST /api/admin/bookkeeping/reconcile-dla
 *
 * Turns the finalised Jul–Sep 2026 director's loan account reconciliation
 * (personally-paid business expenses, agreed with the accountant review
 * flow) into real bookkeeping_drafts — one 'dla_journal' draft per entity
 * with lines to post — using each entity's own real chart of accounts via
 * the same suggestCategory() AI helper the categorize cron uses, so
 * account codes are genuine, not guessed.
 *
 * This runs server-side on Vercel deliberately: it needs a live,
 * possibly-just-refreshed Xero access token (XERO_CLIENT_ID/SECRET are
 * Vercel-only secrets, never available locally), so it has to execute in
 * the deployed environment, not a local script.
 *
 * Idempotent — dedupes on (draft_type, source_ref, entity) exactly like
 * every drafting cron, so calling this more than once is harmless.
 * Nothing is applied to Xero here; that only happens when a human
 * approves the resulting draft in /admin/bookkeeping.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { listChartOfAccounts } from '@/lib/xero';
import { suggestCategory } from '@/lib/bookkeeping-categorize';
import type { XeroEntitySlug } from '@/lib/flowen-entities';

interface Line { date: string; vendor: string; description: string; amount: number }

// The finalised Jul–Sep 2026 reconciliation (see the PDF sent to the
// accountant). Entity assignment follows each company's function in the
// group: Speech Technologies is the trading subsidiary (operating costs,
// customer acquisition); Labs does R&D (the Claude Pro coding-agent
// subscription); Group is the non-trading holding company (only bears
// admin/company-secretarial cost, never anything that looks like trade —
// that distinction matters for keeping Group's SEIS/EIS-qualifying
// holding-company status intact). IP has no items this period.
const RECONCILIATION: Record<XeroEntitySlug, Line[]> = {
  'speech-technologies': [
    { date: '2026-07-02', vendor: 'iCloud+ 2TB', description: 'Subscription — cloud storage', amount: 8.99 },
    { date: '2026-07-02', vendor: 'Google Gemini / AI Plus', description: 'Subscription — AI tool', amount: 4.49 },
    { date: '2026-07-24', vendor: 'Grok (xAI)', description: 'Subscription — AI tool', amount: 23.33 },
    { date: '2026-07-26', vendor: 'Vercel Domains', description: 'Domain registration', amount: 3.61 },
    { date: '2026-08-31', vendor: 'Vercel Inc.', description: 'Hosting', amount: 17.75 },
    { date: '2026-09-02', vendor: 'Meta (Facebook Ads)', description: 'Customer acquisition — 5 charges', amount: 20.72 },
    { date: '2026-09-21', vendor: 'Google Workspace', description: 'flowen.digital email/collaboration', amount: 15.65 },
    { date: '2026-09-21', vendor: 'Google Ads', description: 'Customer acquisition', amount: 4.63 },
    { date: '2026-09-21', vendor: 'Explee', description: 'Content/marketing tool', amount: 4.49 },
    { date: '2026-09-23', vendor: 'Vercel Inc.', description: 'Hosting', amount: 18.02 },
  ],
  labs: [
    { date: '2026-07-28', vendor: 'Claude Pro', description: 'Coding agent — platform engineering (R&D)', amount: 20.00 },
    { date: '2026-08-30', vendor: 'Claude Pro (resub.)', description: 'Coding agent — platform engineering (R&D)', amount: 20.00 },
  ],
  group: [
    { date: '2026-09-19', vendor: '1stformations.co.uk', description: 'Subsidiary registration / company secretarial — 4 charges', amount: 4.80 },
  ],
  ip: [],
};

const NARRATION_PERIOD = '1 Jul – 24 Sep 2026';
const JOURNAL_DATE = '2026-09-25';
const DLA_ACCOUNT_CODE = '835';

export async function POST(): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const supabase = db();
  const results: Record<string, unknown>[] = [];

  for (const [entity, lines] of Object.entries(RECONCILIATION) as [XeroEntitySlug, Line[]][]) {
    if (lines.length === 0) {
      results.push({ entity, skipped: 'no lines for this period' });
      continue;
    }

    const sourceRef = `dla-reconciliation-jul-sep-2026-${entity}`;
    const { data: existingDraft } = await supabase
      .from('bookkeeping_drafts')
      .select('id, status')
      .eq('draft_type', 'dla_journal')
      .eq('source_ref', sourceRef)
      .neq('status', 'rejected')
      .maybeSingle();
    if (existingDraft) {
      results.push({ entity, skipped: `draft already exists (${existingDraft.id}, ${existingDraft.status})` });
      continue;
    }

    try {
      const accounts = (await listChartOfAccounts(entity)).filter(a => a.Class === 'EXPENSE');

      const journalLines: { accountCode: string; description: string; amount: number }[] = [];
      const suggestionNotes: string[] = [];
      let confidenceSum = 0;

      for (const line of lines) {
        const suggestion = await suggestCategory({
          description: `${line.vendor} — ${line.description}`,
          contactName: line.vendor,
          amount: line.amount,
          type: 'SPEND',
          accounts,
        });
        if (!suggestion) continue;
        journalLines.push({
          accountCode: suggestion.accountCode,
          description: `${line.vendor} (${line.date}) — ${line.description}`,
          amount: line.amount,
        });
        confidenceSum += suggestion.confidence;
        suggestionNotes.push(`${line.vendor} → ${suggestion.accountCode} ${suggestion.accountName} (${suggestion.confidence}%): ${suggestion.reasoning}`);
      }

      if (journalLines.length === 0) {
        results.push({ entity, error: 'no line got a valid account suggestion' });
        continue;
      }

      const total = journalLines.reduce((s, l) => s + l.amount, 0);
      const avgConfidence = Math.round(confidenceSum / journalLines.length);

      const { data: inserted, error: insertErr } = await supabase.from('bookkeeping_drafts').insert({
        draft_type: 'dla_journal',
        entity,
        source_ref: sourceRef,
        title: `DLA reconciliation ${NARRATION_PERIOD} — £${total.toFixed(2)} across ${journalLines.length} items`,
        summary: suggestionNotes.join(' | '),
        proposed_payload: {
          narration: `DLA reconciliation ${NARRATION_PERIOD} — personally-paid business expenses reimbursed via director's loan account`,
          date: JOURNAL_DATE,
          dlaAccountCode: DLA_ACCOUNT_CODE,
          lines: journalLines,
        },
        confidence_pct: avgConfidence,
        model: 'claude-sonnet-4-6',
      }).select('id').single();

      if (insertErr) throw new Error(insertErr.message);
      results.push({ entity, draftId: inserted.id, total, lines: journalLines.length, avgConfidence });
    } catch (err) {
      results.push({ entity, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, admin: admin.email, results });
}
