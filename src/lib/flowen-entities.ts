// ── Flowen group entities ──────────────────────────────────────────────────────
// The Flowen group is 4 companies, not one (see the group structure doc under
// /admin/ip-docs): Flowen Group Ltd (holding co.), Flowen IP Ltd (holds IP,
// licenses it to the trading subsidiary), Flowen Speech Technologies Ltd (the
// trading subsidiary — carries on the qualifying trade), and Flowen Labs
// Limited (R&D). Each is its own Xero organisation with its own bank
// accounts, chart of accounts, and VAT position — this is the single source
// of truth for the entity slugs threaded through src/lib/xero.ts and every
// bookkeeping cron/route/table that needs to say which company it's talking
// about.
export const XERO_ENTITIES = [
  { slug: 'group', name: 'Flowen Group Ltd' },
  { slug: 'ip', name: 'Flowen IP Ltd' },
  { slug: 'speech-technologies', name: 'Flowen Speech Technologies Ltd' },
  { slug: 'labs', name: 'Flowen Labs Ltd' },
] as const;

export type XeroEntitySlug = (typeof XERO_ENTITIES)[number]['slug'];

export function isXeroEntitySlug(value: string): value is XeroEntitySlug {
  return (XERO_ENTITIES as readonly { slug: string }[]).some(e => e.slug === value);
}

export function entityName(slug: XeroEntitySlug): string {
  return XERO_ENTITIES.find(e => e.slug === slug)!.name;
}
