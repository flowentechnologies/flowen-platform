// ── AI-drafted response generation ────────────────────────────────────────────
// Every draft this produces lands in ai_drafts with status='pending' and is
// NEVER sent automatically, regardless of confidence_pct — sending only
// happens via an explicit admin action in /admin/inbox (see
// src/lib/gmail.ts sendAs(), which is the sole function anywhere in this
// codebase that actually dispatches mail through Gmail). confidence_pct is
// purely informational, to help the admin triage what needs close review
// vs. a quick skim-and-approve.

import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';

const SYSTEM_PROMPT = `You draft email replies on behalf of Flowen Speech Technology Ltd, a UK company building an AI-assisted speech-fluency platform for adults who stutter. You are drafting a SUGGESTED reply for a human admin to review, edit, and approve — you never send anything yourself.

Write in a warm, direct, professional tone. Keep replies concise (a few short paragraphs at most). Never invent facts, figures, dates, or commitments Flowen hasn't actually made — if the inbound email asks something you don't have a real answer to, say the team will follow up with specifics rather than guessing.

Respond with ONLY a JSON object, no other text:
{"subject": "...", "body": "...", "confidence": <0-100 integer>}

confidence reflects how safe this draft is to send with zero or minimal edits — a routine, low-stakes reply (e.g. acknowledging a support request, confirming receipt) should score high (85-99). Anything touching money, legal commitments, clinical claims, or an emotionally sensitive message from a person who stutters should score lower (below 60), even if the drafted text itself reads fine, because the stakes of getting it wrong are higher.`;

export interface DraftResult {
  subject: string;
  body: string;
  confidence: number;
}

export async function generateReplyDraft(opts: {
  alias: string;
  category: string;
  fromName: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
}): Promise<DraftResult | null> {
  if (requireAnthropicKey()) return null; // ANTHROPIC_API_KEY not configured — skip, don't throw

  const userPrompt = `Inbound email to Flowen's ${opts.alias}@flowen.digital address (category: ${opts.category}):

From: ${opts.fromName ?? opts.fromAddress} <${opts.fromAddress}>
Subject: ${opts.subject}

${opts.bodyText.slice(0, 4000)}

Draft a reply.`;

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = msg.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<DraftResult>;
    if (!parsed.subject || !parsed.body || typeof parsed.confidence !== 'number') return null;

    return {
      subject: parsed.subject,
      body: parsed.body,
      confidence: Math.max(0, Math.min(100, Math.round(parsed.confidence))),
    };
  } catch (err) {
    console.error('[inbox-draft] generation failed:', err);
    return null;
  }
}
