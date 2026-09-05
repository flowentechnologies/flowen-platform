// ── AI-driven CRM contact scan ────────────────────────────────────────────────
// The alias/domain-based rules in inbox-categorize.ts (investors@, .nhs.uk,
// vendor domains) only catch the obvious cases. Real gaps found by
// inspecting actual synced mail: a genuine investor introduced by a
// networking tool (Boardy) whose email has no special alias or domain
// signal at all, a startup-fundraising platform (Pitchdrive) that isn't in
// any vendor list, real individual people replying from personal addresses.
// No fixed rule set catches "is this a genuine business relationship worth
// tracking" reliably — that's a judgement call, so it goes to Claude
// (same pattern already used for reply drafts in inbox-draft.ts) instead
// of an ever-growing brittle keyword list.

import { getAnthropicClient, requireAnthropicKey } from '@/lib/anthropic';

const SYSTEM_PROMPT = `You triage inbound email senders for Flowen Speech Technology Ltd, a UK company building an AI-assisted speech-fluency platform for adults who stutter, currently pre-seed fundraising and pursuing NHS/grant routes to market.

Given a sender's name, email address, and the subject lines of email(s) they've sent, decide whether this represents a genuine business relationship worth tracking in a CRM pipeline, or whether it's something that shouldn't be tracked (automated marketing/notification noise, a platform's own system mail, an internal team address, a one-off transactional email with no ongoing relationship).

If it should be tracked, classify it into exactly one category:
- investor: an angel/VC/fund, or someone introduced specifically as a potential investor
- grant: a grant body, funding programme, or accelerator (e.g. SBRI, Innovate UK, an accelerator/pitch platform connecting startups to capital)
- nhs_partner: an NHS trust, ICB, clinician, or NHS-adjacent partnership contact
- press: a journalist or media contact
- affiliate: a referral/affiliate partner
- vendor: a service provider or supplier Flowen pays for something
- other: a genuine business contact (a real person, real ongoing correspondence) that doesn't fit the above

Respond with ONLY a JSON object, no other text:
{"should_track": <boolean>, "category": "<one of the above, or omit if should_track is false>", "reason": "<one short sentence>"}`;

export interface ContactClassification {
  shouldTrack: boolean;
  category: 'investor' | 'grant' | 'nhs_partner' | 'press' | 'affiliate' | 'vendor' | 'other' | null;
  reason: string;
}

export async function classifyContact(opts: {
  fromName: string | null;
  fromAddress: string;
  subjects: string[]; // one or more subject lines from this sender
}): Promise<ContactClassification | null> {
  if (requireAnthropicKey()) return null;

  const userPrompt = `Sender: ${opts.fromName ?? '(no display name)'} <${opts.fromAddress}>
Subject line(s) from this sender:
${opts.subjects.slice(0, 5).map(s => `- ${s}`).join('\n')}

Classify.`;

  try {
    const msg = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = msg.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { should_track?: boolean; category?: string; reason?: string };
    if (typeof parsed.should_track !== 'boolean') return null;

    const validCategories = ['investor', 'grant', 'nhs_partner', 'press', 'affiliate', 'vendor', 'other'];
    const category = parsed.should_track && validCategories.includes(parsed.category ?? '')
      ? (parsed.category as ContactClassification['category'])
      : null;

    return {
      shouldTrack: parsed.should_track && category !== null,
      category,
      reason: parsed.reason ?? '',
    };
  } catch (err) {
    console.error('[inbox-contact-scan] classification failed:', err);
    return null;
  }
}
