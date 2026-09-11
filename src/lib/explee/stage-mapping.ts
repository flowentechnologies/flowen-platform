/**
 * Derives a crm_contacts.stage from Explee's own outreach signals, so the
 * CRM Kanban actually reflects reality — a contact who's replied with real
 * interest shows up in "In Discussion", one who said no lands in "Lost",
 * and a contact who's just been emailed with no reply yet is "Contacted",
 * not stuck in "New" (which used to be hardcoded for every single import
 * regardless of how far along the conversation actually was).
 *
 * A contact can be linked to more than one Explee campaign thread (the
 * same person targeted twice); the strongest signal across all of them
 * wins — a hot_lead in one campaign outranks a not_interested in another,
 * since it's the more commercially relevant fact.
 *
 * "won" is never derived here — closing a deal is a human judgement call
 * Explee has no way to make.
 */

export type CrmStage = 'new' | 'contacted' | 'in_discussion' | 'won' | 'lost';

export interface ExpleeThreadSignal {
  intent:     string | null;
  sentCount:  number;
  replyCount: number;
}

export function deriveExpleeStage(threads: ExpleeThreadSignal[]): CrmStage {
  if (threads.some(t => t.intent === 'hot_lead')) return 'in_discussion';
  if (threads.some(t => t.intent === 'not_interested')) return 'lost';
  if (threads.some(t => t.replyCount > 0)) return 'contacted';
  if (threads.some(t => t.sentCount > 0)) return 'contacted';
  return 'new';
}
