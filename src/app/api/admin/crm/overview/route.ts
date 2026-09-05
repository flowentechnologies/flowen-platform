/**
 * /api/admin/crm/overview
 *
 * GET  — fast, no AI: counts by category/stage, deal value totals, vendor
 *        spend (last 30 days), and the live venture_config snapshot — one
 *        summary spanning every pipeline the founder actually cares about
 *        (CRM/investor, NHS/ICB partners, vendors, grants), not just the
 *        contacts board.
 * POST — AI-generated "recommended next steps", on demand (not run on
 *        every page load): given the full current snapshot, asks Claude
 *        for a short prioritised list. This is a suggestion for a human to
 *        act on or ignore, never an automated action — nothing here sends
 *        anything or changes any record.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const supabase = db();
  const [{ data: contacts }, { data: invoices }, { data: venture }] = await Promise.all([
    supabase.from('crm_contacts').select('category, stage, deal_value_pence, deal_currency'),
    supabase.from('vendor_invoices').select('vendor_name, amount_pence, currency').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()),
    supabase.from('venture_config').select('cash_in_bank_pence, monthly_burn_pence, target_raise_pence, committed_pence').eq('id', 1).maybeSingle(),
  ]);

  const byCategory: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const dealValueByCategory: Record<string, number> = {};
  for (const c of contacts ?? []) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
    if (c.deal_value_pence) dealValueByCategory[c.category] = (dealValueByCategory[c.category] ?? 0) + c.deal_value_pence;
  }

  const vendorSpendPence = (invoices ?? []).reduce((sum, i) => sum + (i.amount_pence ?? 0), 0);
  const byVendor: Record<string, number> = {};
  for (const i of invoices ?? []) byVendor[i.vendor_name] = (byVendor[i.vendor_name] ?? 0) + (i.amount_pence ?? 0);

  return NextResponse.json({
    total_contacts: contacts?.length ?? 0,
    by_category: byCategory,
    by_stage: byStage,
    deal_value_by_category_pence: dealValueByCategory,
    vendor_spend_30d_pence: vendorSpendPence,
    vendor_spend_by_vendor_pence: byVendor,
    venture: venture ?? null,
  });
}

export async function POST(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
  if (requireAnthropicKey()) return NextResponse.json({ error: 'AI features are not configured' }, { status: 503 });

  const supabase = db();
  const [{ data: contacts }, { data: venture }, { data: invoices }] = await Promise.all([
    supabase.from('crm_contacts').select('name, email, company, category, stage, deal_value_pence, deal_currency, last_contact_at, notes').order('last_contact_at', { ascending: true, nullsFirst: true }).limit(200),
    supabase.from('venture_config').select('round_type, target_raise_pence, committed_pence, cash_in_bank_pence, monthly_burn_pence').eq('id', 1).maybeSingle(),
    supabase.from('vendor_invoices').select('vendor_name, amount_pence').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()),
  ]);

  const gbp = (pence: number | null | undefined) => pence != null ? `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : 'unknown';
  const daysSince = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000) : null;

  const contactLines = (contacts ?? []).map(c => {
    const days = daysSince(c.last_contact_at);
    return `- [${c.category}/${c.stage}] ${c.name ?? c.email} (${c.company ?? '—'})${c.deal_value_pence ? ` — deal value ${gbp(c.deal_value_pence)}` : ''}${days !== null ? ` — last contact ${days}d ago` : ' — never contacted'}`;
  }).join('\n');

  const vendorTotal = (invoices ?? []).reduce((s, i) => s + (i.amount_pence ?? 0), 0);

  const prompt = `Flowen Speech Technology Ltd — current pipeline snapshot.

VENTURE: ${venture?.round_type ?? 'unknown'} round, target £${((venture?.target_raise_pence ?? 0) / 100).toLocaleString('en-GB')}, committed ${gbp(venture?.committed_pence)}, cash in bank ${gbp(venture?.cash_in_bank_pence)}, monthly burn ${gbp(venture?.monthly_burn_pence)}.

VENDOR SPEND (last 30 days): ${gbp(vendorTotal)} total across ${(invoices ?? []).length} invoices.

CRM CONTACTS (${contacts?.length ?? 0} total, oldest-contacted first):
${contactLines || '(none)'}

Give a short, prioritised list of recommended next steps across all of this — investor/fundraising contacts, NHS/ICB partnerships, grants, vendors, and general CRM follow-ups. Be specific (name who to follow up with and why), not generic advice. Flag anything that looks stale or time-sensitive. Keep it to at most 8 bullet points. Plain text, no markdown headers.`;

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const textBlock = msg.content.find(b => b.type === 'text');
    const recommendations = textBlock && textBlock.type === 'text' ? textBlock.text : 'No recommendations generated.';
    return NextResponse.json({ recommendations, generated_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Generation failed' }, { status: 500 });
  }
}
