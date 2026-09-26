/**
 * GET /api/admin/bookkeeping/check-vendor-contacts
 *
 * Read-only check: for every vendor in the Jul-Sep 2026 vendor entity
 * realignment (see the "Vendor Entity Realignment" artifact — Meta Ads,
 * Google Workspace, Vercel, Explee, iCloud+, Gemini, Grok, Google Ads under
 * Speech Technologies; Claude Pro under Labs), does a matching Xero Contact
 * already exist under that vendor's correct entity's own Xero organisation?
 *
 * Answers "will the categorize cron actually match this vendor's future
 * bank transactions to a sensible contact" without guessing — a contact
 * doesn't need to exist ahead of time (categorizeBankTransaction/createXeroBill
 * create one on first real transaction if missing), but knowing which ones
 * are already there vs. will be auto-created on first use is useful before
 * assuming everything downstream "just works" now that billing entities
 * have changed.
 *
 * Never writes anything — findXeroContactByName is a plain GET.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { findXeroContactByName } from '@/lib/xero';
import type { XeroEntitySlug } from '@/lib/flowen-entities';

const VENDOR_ENTITY_MAP: { vendor: string; entity: XeroEntitySlug; aliases?: string[] }[] = [
  { vendor: 'Meta',                 entity: 'speech-technologies', aliases: ['Facebook Ads', 'Meta Ads', 'Meta Platforms'] },
  { vendor: 'Google Workspace',     entity: 'speech-technologies' },
  { vendor: 'Vercel',               entity: 'speech-technologies', aliases: ['Vercel Inc.'] },
  { vendor: 'Explee',               entity: 'speech-technologies' },
  { vendor: 'iCloud+ 2TB',          entity: 'speech-technologies', aliases: ['Apple', 'iCloud'] },
  { vendor: 'Google Gemini',        entity: 'speech-technologies', aliases: ['Google AI Plus'] },
  { vendor: 'Grok',                 entity: 'speech-technologies', aliases: ['xAI'] },
  { vendor: 'Google Ads',           entity: 'speech-technologies' },
  { vendor: 'Claude Pro',           entity: 'labs',                aliases: ['Anthropic'] },
];

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const results: Record<string, unknown>[] = [];

  for (const { vendor, entity, aliases } of VENDOR_ENTITY_MAP) {
    const namesToTry = [vendor, ...(aliases ?? [])];
    let found: { name: string; contactId: string } | null = null;
    let error: string | null = null;

    for (const name of namesToTry) {
      try {
        const contact = await findXeroContactByName(entity, name);
        if (contact) { found = { name: contact.Name, contactId: contact.ContactID }; break; }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    results.push({
      vendor, entity,
      status: error ? 'error' : found ? 'exists' : 'not_yet_created',
      matchedContact: found?.name ?? null,
      error,
    });
  }

  return NextResponse.json({ ok: true, results });
}
