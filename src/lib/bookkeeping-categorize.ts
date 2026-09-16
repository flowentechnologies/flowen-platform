// ── AI bank transaction categorisation ────────────────────────────────────────
// Every suggestion this produces lands in bookkeeping_drafts with
// status='pending' and is NEVER applied to Xero automatically — approval
// only happens via an explicit admin action in /admin/bookkeeping (see
// src/app/api/admin/bookkeeping/drafts/route.ts, the sole route anywhere in
// this codebase that actually calls categorizeBankTransaction()).

import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';
import type { XeroAccount } from '@/lib/xero';

const SYSTEM_PROMPT = `You categorise UK small-business bank transactions into Xero chart-of-accounts codes on behalf of Flowen Group Limited. You are proposing a SUGGESTED category for a human admin to review and approve — you never post anything to Xero yourself.

Respond with ONLY a JSON object, no other text:
{"accountCode": "...", "reasoning": "...", "confidence": <0-100 integer>}

accountCode MUST be exactly one of the codes given in the chart of accounts list below — never invent a code, and never return a code that isn't in the list. If nothing in the list is a clear fit, pick the closest general-purpose match (e.g. a generic "Other expenses" or "Miscellaneous" account if one exists) rather than guessing at a code that doesn't exist.

confidence reflects how obvious the category is from the description alone — a transaction with a well-known vendor name or an unambiguous description (e.g. "AWS", "Google Workspace", client name matching a known revenue stream) should score high (85-99). A generic bank description, an unfamiliar counterparty, or anything that could plausibly belong to more than one account should score lower (below 60), even if you did pick an answer, because the stakes of miscategorising spend for tax purposes are real.`;

export interface CategorizeResult {
  accountCode: string;
  accountName: string;
  reasoning: string;
  confidence: number;
}

export async function suggestCategory(opts: {
  description: string;
  contactName?: string;
  amount: number;
  type: string; // Xero BankTransaction.Type — 'SPEND' or 'RECEIVE'
  accounts: XeroAccount[];
}): Promise<CategorizeResult | null> {
  if (requireAnthropicKey()) return null; // ANTHROPIC_API_KEY not configured — skip, don't throw
  if (opts.accounts.length === 0) return null; // nothing to categorise into

  const accountList = opts.accounts.map(a => `${a.Code} — ${a.Name} (${a.Class}/${a.Type})`).join('\n');
  const userPrompt = `Transaction: ${opts.type} of ${opts.amount.toFixed(2)}${opts.contactName ? ` with ${opts.contactName}` : ''}
Description: ${opts.description}

Chart of accounts:
${accountList}

Suggest the best account code for this transaction.`;

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = msg.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<{ accountCode: string; reasoning: string; confidence: number }>;
    if (!parsed.accountCode || typeof parsed.confidence !== 'number') return null;

    // Never trust the model's account code at face value — only accept one
    // that actually exists in the chart of accounts we gave it, so a
    // hallucinated code can never reach the approval screen looking valid.
    const match = opts.accounts.find(a => a.Code === parsed.accountCode);
    if (!match) return null;

    return {
      accountCode: match.Code,
      accountName: match.Name,
      reasoning: parsed.reasoning ?? '',
      confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence))),
    };
  } catch (err) {
    console.error('[bookkeeping-categorize] suggestion failed:', err);
    return null;
  }
}
