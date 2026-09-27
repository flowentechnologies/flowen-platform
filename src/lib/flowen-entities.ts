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
// companyNumber is the Companies House registration number, verified against
// the public register — this is now the single place it's typed in, after
// finding it duplicated as a bare string literal (with no drift yet, but no
// guard against it either) across content.tsx, dpa/page.tsx, and
// legal/policies.ts. Static facts, not DB-backed — a registration number
// doesn't change — but "correct in one place, not independently retyped
// in three" is still the point: this session already found and fixed one
// real instance of a wrong suffix (Labs Ltd vs Limited) drifting between
// documents that each held their own copy of the same fact.
export const XERO_ENTITIES = [
  { slug: 'group', name: 'Flowen Group Ltd', companyNumber: '17452036' },
  { slug: 'ip', name: 'Flowen IP Ltd', companyNumber: '17471287' },
  { slug: 'speech-technologies', name: 'Flowen Speech Technologies Ltd', companyNumber: '17470700' },
  { slug: 'labs', name: 'Flowen Labs Ltd', companyNumber: '17471295' },
] as const;

export type XeroEntitySlug = (typeof XERO_ENTITIES)[number]['slug'];

export function isXeroEntitySlug(value: string): value is XeroEntitySlug {
  return (XERO_ENTITIES as readonly { slug: string }[]).some(e => e.slug === value);
}

export function entityName(slug: XeroEntitySlug): string {
  return XERO_ENTITIES.find(e => e.slug === slug)!.name;
}

export function entityCompanyNumber(slug: XeroEntitySlug): string {
  return XERO_ENTITIES.find(e => e.slug === slug)!.companyNumber;
}

// All 4 entities share one registered office (a company-formation agent's
// address, standard practice for a group this size) — found independently
// retyped across content.tsx, legal/policies.ts, and admin/policies/page.tsx
// (7 occurrences total, all consistent as of this fix, but with nothing
// stopping that).
export const REGISTERED_OFFICE_ADDRESS = '71-75 Shelton Street, Covent Garden, London, WC2H 9JQ';
