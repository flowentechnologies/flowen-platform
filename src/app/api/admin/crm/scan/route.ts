/**
 * POST /api/admin/crm/scan
 *
 * Broader, AI-driven backfill for CRM contacts that the alias/domain rules
 * in inbox-categorize.ts miss entirely — a genuine investor introduced by
 * a networking tool with no special alias, a fundraising platform with no
 * vendor-list entry, a real person replying from a personal address. Scans
 * inbox_items with no linked CRM contact yet, groups by sender, and asks
 * Claude to judge each one (see inbox-contact-scan.ts for why this isn't a
 * keyword list). Capped per run to keep response time and API cost
 * reasonable — re-run for more.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { isAutomatedMail } from '@/lib/inbox-categorize';
import { classifyContact } from '@/lib/inbox-contact-scan';

const MAX_SENDERS_PER_RUN = 30;

export async function POST(_req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const supabase = db();
  const { data: candidates, error } = await supabase
    .from('inbox_items')
    .select('id, from_address, from_name, subject, gmail_category, category, received_at')
    .is('crm_contact_id', null)
    .neq('category', 'billing')
    .order('received_at', { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by sender, excluding Flowen's own addresses and mail already
  // known to be automated/marketing noise (same rule used to skip AI
  // drafts) — cheap filters before spending a Claude call on anything.
  interface SenderEntry { fromName: string | null; subjects: string[]; itemIds: string[]; lastReceivedAt: string }
  const bySender = new Map<string, SenderEntry>();
  for (const item of candidates ?? []) {
    if (item.from_address.endsWith('@flowen.digital')) continue;
    if (isAutomatedMail({ fromAddress: item.from_address, gmailCategory: item.gmail_category })) continue;
    const entry: SenderEntry = bySender.get(item.from_address) ?? { fromName: item.from_name, subjects: [], itemIds: [], lastReceivedAt: item.received_at };
    entry.subjects.push(item.subject);
    entry.itemIds.push(item.id);
    // candidates is ordered received_at desc, so the first item seen per
    // sender is already their most recent — kept explicit rather than
    // relying on iteration order in case that ever changes.
    if (item.received_at > entry.lastReceivedAt) entry.lastReceivedAt = item.received_at;
    bySender.set(item.from_address, entry);
  }

  const senders = [...bySender.entries()].slice(0, MAX_SENDERS_PER_RUN);
  const results = { scanned: senders.length, added: 0, skipped: 0, details: [] as { email: string; result: string }[] };

  for (const [fromAddress, info] of senders) {
    const classification = await classifyContact({
      fromName: info.fromName,
      fromAddress,
      subjects: info.subjects,
    });

    if (!classification || !classification.shouldTrack || !classification.category) {
      results.skipped++;
      results.details.push({ email: fromAddress, result: `skipped: ${classification?.reason ?? 'classification failed'}` });
      continue;
    }

    const { data: contact } = await supabase
      .from('crm_contacts')
      .upsert({
        email: fromAddress,
        name: info.fromName,
        category: classification.category,
        source: 'inbox:scan',
        last_contact_at: info.lastReceivedAt,
      }, { onConflict: 'email', ignoreDuplicates: false })
      .select('id')
      .single();

    if (contact) {
      await supabase.from('crm_activities').insert({
        crm_contact_id: contact.id,
        type: 'note',
        body: `Auto-detected via inbox scan: ${classification.reason}`,
        created_by: admin.id,
      });
      await supabase.from('inbox_items').update({ crm_contact_id: contact.id }).in('id', info.itemIds);
      results.added++;
      results.details.push({ email: fromAddress, result: `added as ${classification.category}` });
    } else {
      results.skipped++;
      results.details.push({ email: fromAddress, result: 'skipped: contact upsert failed' });
    }
  }

  return NextResponse.json(results);
}
