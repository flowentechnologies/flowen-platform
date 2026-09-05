/**
 * POST /api/cron/gmail-sync
 *
 * The core inbox automation worker. Runs hourly:
 *   1. Lists recent Gmail messages (Spam included — Gmail search excludes
 *      it by default; Trash stays excluded), skips any already synced.
 *   2. Categorises each two ways: `category` by alias + vendor-domain +
 *      keyword heuristics (which business function — billing/press/
 *      security/...), and `gmail_category` from Gmail's own system labels
 *      (primary/social/promotions/updates/forums/spam — the same
 *      classification behind Gmail's own inbox tabs).
 *   3. Applies a "Flowen/<category>" label in Gmail itself.
 *   4. Spam -> synced and labelled for visibility, otherwise left alone
 *      entirely (no billing/CRM/draft/notification — see below).
 *   5. Billing mail -> extracts a vendor_invoices row.
 *   6. CRM-relevant mail (investors@, affiliates@, press@, *.nhs.uk) ->
 *      upserts a crm_contacts row.
 *   7. Drafts a suggested reply via Claude (skipped for billing and spam)
 *      and queues it in ai_drafts with status='pending'.
 *   8. Raises an admin_notifications row for anything that needs eyes
 *      (skipped for spam — a notification per spam message would be noise).
 *
 * Nothing here ever sends mail. The only function anywhere in this codebase
 * that dispatches an email via Gmail is sendAs() in src/lib/gmail.ts, and
 * it is only ever called from the explicit admin-approval route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import {
  listRecentMessageIds, getMessage, extractBodyText, getHeader, resolveAlias, applyLabel,
  resolveGmailCategory,
} from '@/lib/gmail';
import { categorize, extractAmountPence } from '@/lib/inbox-categorize';
import { generateReplyDraft } from '@/lib/inbox-draft';

const LABEL_PREFIX = 'Flowen';

function labelForCategory(category: string): string {
  return `${LABEL_PREFIX}/${category.charAt(0).toUpperCase()}${category.slice(1)}`;
}

async function notify(type: string, title: string, body: string, link: string): Promise<void> {
  await db().from('admin_notifications').insert({ type, title, body, link });
}

// Vercel Cron always invokes via GET (with Authorization: Bearer CRON_SECRET);
// /admin/cron's manual trigger uses POST (with x-cron-secret) — verifyCronRequest
// accepts either, so both methods need to route to the same handler.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = db();
  const results = { scanned: 0, synced: 0, billing: 0, crm: 0, drafts: 0, spam: 0, errors: [] as string[] };

  let messageIds: string[];
  try {
    messageIds = await listRecentMessageIds(50);
  } catch (err) {
    // Gmail not connected yet, or token refresh failed — not an error worth
    // alerting on repeatedly; the /admin/inbox page surfaces connection status.
    return NextResponse.json({ skipped: true, reason: String(err) });
  }

  for (const id of messageIds) {
    results.scanned++;
    try {
      const { data: exists } = await supabase
        .from('inbox_items').select('id').eq('gmail_message_id', id).maybeSingle();
      if (exists) continue;

      const msg = await getMessage(id);
      const alias = resolveAlias(msg.payload);
      const fromHeader = getHeader(msg.payload, 'From') ?? '';
      const fromMatch = fromHeader.match(/^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
      const fromName = fromMatch?.[1]?.trim() || null;
      const fromAddress = (fromMatch?.[2] ?? fromHeader).toLowerCase();
      const subject = getHeader(msg.payload, 'Subject') ?? '(no subject)';
      const bodyText = extractBodyText(msg.payload);
      const receivedAt = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : new Date().toISOString();

      const cat = categorize({ alias, fromAddress, subject, snippet: msg.snippet ?? '' });
      const gmailCategory = resolveGmailCategory(msg.labelIds);
      const isSpam = gmailCategory === 'spam';

      // ── CRM upsert (before inbox insert, so we can link crm_contact_id) ──
      // Skipped for spam — a spoofed sender matching a CRM heuristic (e.g. a
      // fake .nhs.uk domain) shouldn't create a pipeline contact.
      let crmContactId: string | null = null;
      if (cat.crmCategory && !isSpam) {
        const { data: crmRow } = await supabase
          .from('crm_contacts')
          .upsert({
            email: fromAddress,
            name: fromName,
            category: cat.crmCategory,
            source: `inbox:${alias}@`,
            last_contact_at: receivedAt,
          }, { onConflict: 'email', ignoreDuplicates: false })
          .select('id, stage')
          .single();
        if (crmRow) {
          crmContactId = crmRow.id;
          results.crm++;
        }
      }

      const { data: inboxRow, error: insertErr } = await supabase
        .from('inbox_items')
        .insert({
          gmail_message_id: id,
          gmail_thread_id: msg.threadId,
          alias,
          from_address: fromAddress,
          from_name: fromName,
          to_addresses: [getHeader(msg.payload, 'To') ?? ''],
          subject,
          snippet: msg.snippet ?? '',
          body_text: bodyText,
          received_at: receivedAt,
          category: cat.category,
          gmail_category: gmailCategory,
          is_billing: cat.isBilling,
          vendor_name: cat.vendorName,
          crm_contact_id: crmContactId,
          labels_applied: [labelForCategory(cat.category)],
        })
        .select('id')
        .single();

      if (insertErr || !inboxRow) {
        results.errors.push(`insert ${id}: ${insertErr?.message}`);
        continue;
      }
      results.synced++;

      // Best-effort — a labelling failure shouldn't block the rest of sync.
      try { await applyLabel(id, labelForCategory(cat.category)); } catch { /* non-fatal */ }

      // ── Billing ──────────────────────────────────────────────────────────
      if (isSpam) {
        // Synced and labelled (visible in /admin/inbox filtered to Spam) but
        // otherwise left alone entirely — no billing extraction, no CRM, no
        // AI draft, no notification. Drafting a reply to spam is pointless
        // and a notification for every spam message would just be noise,
        // defeating the point of the notification system.
        results.spam++;
      } else if (cat.isBilling) {
        const amount = extractAmountPence(`${subject} ${msg.snippet ?? ''}`);
        await supabase.from('vendor_invoices').insert({
          inbox_item_id: inboxRow.id,
          vendor_name: cat.vendorName ?? fromAddress.split('@')[1],
          amount_pence: amount?.amountPence ?? null,
          currency: amount?.currency ?? 'gbp',
          description: subject,
        });
        results.billing++;
        await notify('vendor_invoice', `New invoice: ${cat.vendorName ?? fromAddress}`, subject, '/admin/vendor-invoices');
      } else {
        // ── AI draft (skipped for billing and spam) ─────────────────────────
        const draft = await generateReplyDraft({
          alias, category: cat.category, fromName, fromAddress, subject, bodyText,
        });
        if (draft) {
          await supabase.from('ai_drafts').insert({
            draft_type: 'reply',
            inbox_item_id: inboxRow.id,
            crm_contact_id: crmContactId,
            to_address: fromAddress,
            from_alias: alias,
            subject: draft.subject,
            body_text: draft.body,
            confidence_pct: draft.confidence,
            model: 'claude-sonnet-4-6',
          });
          results.drafts++;
          await notify('draft_pending', `Draft ready: ${subject}`, `${draft.confidence}% confidence`, '/admin/inbox');
        }

        if (crmContactId) {
          await notify('crm_new', `New ${cat.crmCategory} contact`, fromAddress, '/admin/crm');
        } else {
          await notify('inbox_new', `New ${cat.category} email`, subject, '/admin/inbox');
        }
      }
    } catch (err) {
      results.errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json(results);
}
