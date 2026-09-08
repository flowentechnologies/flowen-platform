/**
 * Normalizes a raw variant value (a DB column read, or a value posted from
 * the admin "New Investor Link" form) down to the two real deck variants.
 * Centralized so the three places that need this decision — the admin
 * create-invite route, the HTML-serving route, and the PDF route — can't
 * drift into checking the string differently (e.g. one spot handling
 * `undefined` and another not, after this column is null on any row that
 * predates the variant migration).
 */
export type DeckVariant = 'detailed' | 'simple';

export function resolveDeckVariant(raw: unknown): DeckVariant {
  return raw === 'simple' ? 'simple' : 'detailed';
}
