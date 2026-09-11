/**
 * /api/cron/explee-outreach-sync
 *
 * Pulls the FULL Explee outreach picture into Flowen — not just hot leads
 * (that's /api/cron/explee-hot-leads, which feeds the CRM pipeline) but
 * campaign performance, every person contacted, and every email/reply in
 * each conversation. Answers "what about the emails sent — gather all data
 * from Explee to enrich the platform." Surfaced at /admin/outreach.
 *
 * Runs every 10 minutes (vercel.json), same cadence as the hot-leads sync,
 * scoped to the same project (33901). Each run:
 *   1. Lists the project's campaigns, upserts explee_campaigns + their
 *      lifetime analytics (small table, ~10 rows — always fully refreshed).
 *   2. Pages through each campaign's inbox (every contacted person, not
 *      just hot ones) and upserts explee_contacts.
 *   3. For any contact whose latest_sent_at/latest_reply_at moved since
 *      last sync — i.e. something new happened on that thread — fetches
 *      the full conversation and stores any messages we don't already
 *      have. This avoids re-fetching hundreds of unchanged threads every
 *      10 minutes as the contact list grows.
 *   4. Imports every emailed contact into the CRM: links
 *      explee_contacts.crm_contact_id by email where that person is
 *      already a CRM contact, and creates a new crm_contacts row
 *      (category='sales_lead', source='explee', stage derived from
 *      their actual sent/reply/intent — see stage-mapping.ts, not
 *      hardcoded 'new') when they're not — never touching
 *      category/notes on an existing row, so a human's own triage is
 *      never overwritten. explee-hot-leads (separate cron) enriches
 *      the subset of these that Explee itself flags as hot with job
 *      title/company/LinkedIn.
 *   5. Re-derives stage for every source='explee' contact whose stage
 *      is still auto-managed (crm_contacts.stage_auto_managed), so the
 *      Kanban keeps reflecting reality as replies come in — moving to
 *      "in_discussion" on a hot reply, "lost" on an explicit no. Stops
 *      touching a contact for good the moment a human sets its stage
 *      by hand via the CRM UI.
 *   6. Records a project-analytics snapshot, but only when the numbers
 *      actually moved since the last one, so the trend log stays
 *      meaningful rather than 144 identical rows a day.
 *
 * Resilience notes (successful runs were already taking 230-299s against
 * Vercel's 300s function ceiling, and a single flaky upstream call used to
 * abort the entire run):
 *   - A per-campaign time budget (TIME_BUDGET_MS) stops the job from
 *     starting new work once it's cutting it close, returning `partial:
 *     true` instead of risking an HTTP 504. The next scheduled run (10 min
 *     later) picks up wherever this one stopped.
 *   - Step 3's thread fetches run with bounded concurrency
 *     (THREAD_FETCH_CONCURRENCY) instead of one at a time — they're
 *     independent calls and were the dominant per-run cost.
 *   - Each campaign's analytics/inbox fetch and each contact's thread
 *     fetch is individually try/caught, so one upstream hiccup (Explee's
 *     own transient 503s) skips just that item instead of killing the
 *     whole run.
 *   - A changed contact's latest_sent_at/latest_reply_at is only persisted
 *     *after* its thread is successfully fetched and stored — never
 *     before — so an interrupted or failed fetch is always retried on the
 *     next run instead of being silently treated as already synced.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { withCronLogging } from '@/lib/cron-logging';
import { isContactChanged, hasTimeBudget } from '@/lib/explee/outreach-sync';
import { planCrmImport, type UnlinkedExpleeContact } from '@/lib/explee/crm-import';
import { deriveExpleeStage } from '@/lib/explee/stage-mapping';
import { mapWithConcurrency } from '@/lib/async/concurrency';

const EXPLEE_BASE = 'https://api.explee.com';
const EXPLEE_PROJECT_ID = 33901;
const PAGE_LIMIT = 200;
// Successful runs were already clocking 230-299s against Vercel's 300s
// function ceiling — some tipped over into an outright 504. Stop starting
// new campaigns past this mark and report a partial result instead; the
// next scheduled run (10 min later) picks up wherever this one left off.
const TIME_BUDGET_MS = 260_000;
// Per-contact thread fetches are the dominant per-campaign cost and were
// fully sequential. They're independent I/O-bound calls, so run a bounded
// batch concurrently instead of one at a time.
const THREAD_FETCH_CONCURRENCY = 5;

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key };
}

async function expleeGet<T>(path: string): Promise<T> {
  const res = await fetch(`${EXPLEE_BASE}${path}`, { headers: expleeHeaders() });
  if (!res.ok) throw new Error(`Explee ${path} -> ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

interface ExpleeCampaign { id: number; project_id: number; name: string }

interface CampaignAnalytics {
  campaign_id: number; name: string; status: string; status_reason: string | null;
  daily_budget_usd: number; emails_sent: number; total_replies: number; reply_rate_pct: number;
  hot_leads: number; spend_usd: number; cost_per_lead_usd: number;
  leads_pool_used: number; leads_pool_total: number; leads_pool_pending: number;
  collected_leads_total: number; cold_lost: number; manual_status_counts: Record<string, number>;
}

interface InboxContactItem {
  person_id: string | null; email: string | null; name: string | null;
  latest_subject: string | null; latest_sent_at: string | null; latest_reply_at: string | null;
  latest_intent: string | null; sent_count: number; reply_count: number;
}
interface InboxContactsResponse { contacts: InboxContactItem[]; has_more: boolean; next_offset: number | null }

interface ThreadMessage {
  type: 'sent' | 'reply'; message_id: string | null; from_email: string | null; to_email: string | null;
  subject: string | null; body_text: string | null; intent: string | null; status: string | null;
  in_reply_to: string | null; ts: string | null;
}
interface ThreadResponse { messages: ThreadMessage[] }

interface ProjectAnalytics {
  project_id: number; total_emails_sent: number; total_replies: number; total_auto_replies: number;
  overall_reply_rate_pct: number; total_hot_leads: number; total_spend_usd: number;
}

async function paginateInbox(campaignId: number): Promise<InboxContactItem[]> {
  const all: InboxContactItem[] = [];
  let offset = 0;
  for (;;) {
    const data = await expleeGet<InboxContactsResponse>(
      `/public/api/v1/autogtm/campaigns/${campaignId}/inbox?limit=${PAGE_LIMIT}&offset=${offset}`,
    );
    all.push(...data.contacts);
    if (!data.has_more || data.next_offset === null) break;
    offset = data.next_offset;
  }
  return all;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = db();
  const startedAt = Date.now();
  let partial = false;
  let campaignErrors = 0;
  let threadFetchErrors = 0;

  // ── 1. Campaigns + analytics ─────────────────────────────────────────
  const { campaigns } = await expleeGet<{ campaigns: ExpleeCampaign[] }>(
    `/public/api/v1/autogtm/campaigns?project_id=${EXPLEE_PROJECT_ID}`,
  );

  for (const c of campaigns) {
    // A single campaign's analytics being flaky (Explee's own upstream 503s
    // are common) used to throw out of the whole handler, aborting every
    // other campaign's sync for this run. Log and move on instead.
    try {
      const a = await expleeGet<CampaignAnalytics>(`/public/api/v1/autogtm/campaigns/${c.id}/analytics?period=all`);
      await supabase.from('explee_campaigns').upsert({
        id: c.id, project_id: c.project_id, name: c.name,
        status: a.status, status_reason: a.status_reason, daily_budget_usd: a.daily_budget_usd,
        emails_sent: a.emails_sent, total_replies: a.total_replies, reply_rate_pct: a.reply_rate_pct,
        hot_leads: a.hot_leads, spend_usd: a.spend_usd, cost_per_lead_usd: a.cost_per_lead_usd,
        leads_pool_used: a.leads_pool_used, leads_pool_total: a.leads_pool_total,
        leads_pool_pending: a.leads_pool_pending, collected_leads_total: a.collected_leads_total,
        cold_lost: a.cold_lost, manual_status_counts: a.manual_status_counts,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    } catch (err) {
      console.error(`[explee-outreach-sync] analytics fetch failed for campaign=${c.id}:`, err);
      campaignErrors++;
    }
  }

  // ── 2+3. Contacts (everyone emailed, not just hot leads), and their
  //         changed threads ───────────────────────────────────────────
  let contactsUpserted = 0;
  let messagesStored = 0;
  let threadsFetched = 0;

  for (const c of campaigns) {
    if (!hasTimeBudget(startedAt, TIME_BUDGET_MS)) { partial = true; break; }

    let inboxContacts: InboxContactItem[];
    try {
      inboxContacts = await paginateInbox(c.id);
    } catch (err) {
      console.error(`[explee-outreach-sync] inbox fetch failed for campaign=${c.id}:`, err);
      campaignErrors++;
      continue;
    }
    const withPersonId = inboxContacts.filter((x): x is InboxContactItem & { person_id: string } => !!x.person_id);
    if (withPersonId.length === 0) continue;

    // Compare against what we already have, so we only re-fetch full
    // threads for contacts whose activity actually moved since last sync.
    const { data: existingRows } = await supabase
      .from('explee_contacts')
      .select('person_id, latest_sent_at, latest_reply_at')
      .eq('campaign_id', c.id)
      .in('person_id', withPersonId.map(x => x.person_id));
    const existingByPerson = new Map((existingRows ?? []).map(r => [r.person_id as string, r]));

    const unchanged: (InboxContactItem & { person_id: string })[] = [];
    const changed: (InboxContactItem & { person_id: string })[] = [];
    for (const contact of withPersonId) {
      const prior = existingByPerson.get(contact.person_id);
      (isContactChanged(prior, contact) ? changed : unchanged).push(contact);
    }

    // Unchanged contacts: cheap metadata refresh (name/counts), no thread
    // fetch needed — their latest_* timestamps already match what we have.
    for (const contact of unchanged) {
      const { error } = await supabase.from('explee_contacts').upsert({
        campaign_id: c.id, person_id: contact.person_id,
        email: contact.email, name: contact.name, latest_subject: contact.latest_subject,
        latest_sent_at: contact.latest_sent_at, latest_reply_at: contact.latest_reply_at,
        latest_intent: contact.latest_intent, sent_count: contact.sent_count, reply_count: contact.reply_count,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id,person_id' });
      if (!error) contactsUpserted++;
    }

    if (!hasTimeBudget(startedAt, TIME_BUDGET_MS)) { partial = true; break; }

    // Changed contacts: fetch + store the thread FIRST, and only mark the
    // contact synced (persist its new latest_sent_at/latest_reply_at) once
    // that succeeds. Run a bounded batch concurrently — these are
    // independent network calls to Explee and were the dominant cost of
    // the whole job when done one at a time.
    await mapWithConcurrency(changed, THREAD_FETCH_CONCURRENCY, async (contact) => {
      const personId = contact.person_id;
      try {
        threadsFetched++;
        const thread = await expleeGet<ThreadResponse>(
          `/public/api/v1/autogtm/campaigns/${c.id}/inbox/${encodeURIComponent(personId)}`,
        );

        if (thread.messages.length > 0) {
          const { data: storedMsgs } = await supabase
            .from('explee_messages')
            .select('message_id, sent_at, type, subject')
            .eq('campaign_id', c.id).eq('person_id', personId);
          const storedIds = new Set((storedMsgs ?? []).filter(m => m.message_id).map(m => m.message_id));
          // Fallback dedupe key for the rare message with no message_id.
          const storedFallback = new Set((storedMsgs ?? []).filter(m => !m.message_id)
            .map(m => `${m.sent_at ?? ''}|${m.type}|${m.subject ?? ''}`));

          const newMessages = thread.messages.filter(m => {
            if (m.message_id) return !storedIds.has(m.message_id);
            return !storedFallback.has(`${m.ts ?? ''}|${m.type}|${m.subject ?? ''}`);
          });

          if (newMessages.length > 0) {
            const { error } = await supabase.from('explee_messages').insert(newMessages.map(m => ({
              campaign_id: c.id, person_id: personId, message_id: m.message_id, type: m.type,
              from_email: m.from_email, to_email: m.to_email, subject: m.subject, body_text: m.body_text,
              intent: m.intent, status: m.status, in_reply_to: m.in_reply_to, sent_at: m.ts,
            })));
            if (!error) messagesStored += newMessages.length;
          }
        }

        const { error } = await supabase.from('explee_contacts').upsert({
          campaign_id: c.id, person_id: personId,
          email: contact.email, name: contact.name, latest_subject: contact.latest_subject,
          latest_sent_at: contact.latest_sent_at, latest_reply_at: contact.latest_reply_at,
          latest_intent: contact.latest_intent, sent_count: contact.sent_count, reply_count: contact.reply_count,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'campaign_id,person_id' });
        if (!error) contactsUpserted++;
      } catch (err) {
        // A single flaky Explee thread call used to throw out of the whole
        // handler, aborting every remaining campaign for this run. Skip
        // just this contact — it's untouched in the DB, so isContactChanged
        // still sees it as changed and retries it next run.
        console.error(`[explee-outreach-sync] thread fetch failed for campaign=${c.id} person=${personId}:`, err);
        threadFetchErrors++;
      }
    });
  }

  // ── 4. Import every emailed contact into the CRM ────────────────────
  // Used to only ever link — an explee_contacts row with no matching CRM
  // email was silently skipped forever. That meant every contact Explee
  // has emailed but never flagged as a "hot lead" (the separate, much
  // narrower explee-hot-leads cron) never made it into the CRM at all.
  // There is no "loaded but not yet emailed" list anywhere in Explee's
  // API (confirmed by probing it directly — every /inbox entry already
  // has sent_count >= 1), so this covers the full real scope: every
  // contact Explee has ever sent an email to, hot or not. In practice
  // most of Explee's own /inbox rows have no email on file at all (a
  // real data-quality fact on Explee's side, confirmed live: only ~2%
  // of synced contacts have one) — those are skipped here, same as
  // they always have been in explee-hot-leads.
  let crmImported = 0;
  try {
    const { data: unlinkedRows } = await supabase
      .from('explee_contacts')
      .select('id, email, name, person_id, latest_sent_at, latest_intent, sent_count, reply_count')
      .is('crm_contact_id', null).not('email', 'is', null);
    const unlinked = (unlinkedRows ?? []) as UnlinkedExpleeContact[];

    if (unlinked.length > 0) {
      // Batch the lookup — .in() with 1,000+ values risks the practical
      // query-size limit PostgREST enforces on GET request URLs.
      const CRM_LOOKUP_BATCH = 200;
      const existingCrmByEmail = new Map<string, string>();
      for (let i = 0; i < unlinked.length; i += CRM_LOOKUP_BATCH) {
        const batch = unlinked.slice(i, i + CRM_LOOKUP_BATCH).map(c => c.email);
        const { data: matches } = await supabase.from('crm_contacts').select('id, email').in('email', batch);
        for (const m of matches ?? []) existingCrmByEmail.set((m.email as string).toLowerCase(), m.id as string);
      }

      const plan = planCrmImport(unlinked, existingCrmByEmail);

      for (const { expleeContactId, crmContactId } of plan.toLink) {
        await supabase.from('explee_contacts').update({ crm_contact_id: crmContactId }).eq('id', expleeContactId);
      }

      // De-dupe by email within this run — the same person can appear
      // under more than one campaign in the same batch.
      const byEmail = new Map<string, (typeof plan.toCreate)[number]>();
      for (const c of plan.toCreate) {
        const key = c.email.toLowerCase();
        if (!byEmail.has(key)) byEmail.set(key, c);
      }

      for (const c of byEmail.values()) {
        // Initial stage reflects reality from the moment the contact
        // exists in the CRM — a reply-less send lands in "contacted", a
        // hot-classified reply in "in_discussion" — instead of every
        // single import starting at "new" regardless of how far along
        // the conversation already was.
        const initialStage = deriveExpleeStage([{ intent: c.intent, sentCount: c.sentCount, replyCount: c.replyCount }]);
        const { data: created, error } = await supabase.from('crm_contacts').insert({
          email: c.email, name: c.name, category: 'sales_lead', stage: initialStage, source: 'explee',
          explee_person_id: c.personId, last_contact_at: c.lastContactAt,
        }).select('id').single();

        let crmId: string | null = null;
        if (!error && created) {
          crmId = created.id as string;
          crmImported++;
        } else if (error?.code === '23505') {
          // A concurrent run (or explee-hot-leads) created this email
          // between our lookup and this insert — link to it instead of
          // erroring out. Never touch its category/stage either way.
          const { data: existing } = await supabase.from('crm_contacts').select('id').eq('email', c.email).maybeSingle();
          crmId = (existing?.id as string) ?? null;
        } else {
          console.error(`[explee-outreach-sync] CRM insert failed for ${c.email}:`, error);
        }

        if (crmId) {
          const idsForThisEmail = plan.toCreate
            .filter(x => x.email.toLowerCase() === c.email.toLowerCase())
            .map(x => x.expleeContactId);
          await supabase.from('explee_contacts').update({ crm_contact_id: crmId }).in('id', idsForThisEmail);
        }
      }
    }
  } catch (err) {
    console.error('[explee-outreach-sync] CRM import failed:', err);
  }

  // ── 5. Re-sort existing Explee contacts as their outreach evolves ──
  // A contact's stage used to only ever get set once, at creation. If
  // they later reply and Explee reclassifies them (silence -> hot_lead,
  // or a fresh not_interested), nothing moved their CRM stage — every
  // contact imported before this shipped would stay wherever it started
  // forever. Re-derives from the current linked explee_contacts data
  // every run, but only while stage_auto_managed is still true — the
  // moment a human sets a stage by hand (PATCH /api/admin/crm), this
  // stops touching that contact for good.
  let stageResynced = 0;
  try {
    const { data: autoManaged } = await supabase
      .from('crm_contacts')
      .select('id, stage, explee_contacts(latest_intent, sent_count, reply_count)')
      .eq('source', 'explee').eq('stage_auto_managed', true);

    for (const row of (autoManaged ?? []) as unknown as {
      id: string; stage: string;
      explee_contacts: { latest_intent: string | null; sent_count: number; reply_count: number }[] | null;
    }[]) {
      const threads = (row.explee_contacts ?? []).map(t => ({
        intent: t.latest_intent, sentCount: t.sent_count, replyCount: t.reply_count,
      }));
      if (threads.length === 0) continue;

      const derivedStage = deriveExpleeStage(threads);
      if (derivedStage === row.stage) continue;

      await supabase.from('crm_contacts').update({
        stage: derivedStage, updated_at: new Date().toISOString(),
      }).eq('id', row.id);
      await supabase.from('crm_activities').insert({
        crm_contact_id: row.id, type: 'stage_change', body: `${row.stage} → ${derivedStage} (auto, Explee)`,
      });
      stageResynced++;
    }
  } catch (err) {
    console.error('[explee-outreach-sync] stage re-sync failed:', err);
  }

  // ── 6. Project analytics snapshot — only when numbers moved ────────
  let movedSinceLast = false;
  try {
    const projectAnalytics = await expleeGet<ProjectAnalytics>(
      `/public/api/v1/autogtm/projects/${EXPLEE_PROJECT_ID}/analytics?period=all`,
    );
    const { data: lastSnapshot } = await supabase
      .from('explee_analytics_snapshots').select('*')
      .eq('project_id', EXPLEE_PROJECT_ID).order('captured_at', { ascending: false }).limit(1).maybeSingle();
    movedSinceLast = !lastSnapshot
      || lastSnapshot.total_emails_sent !== projectAnalytics.total_emails_sent
      || lastSnapshot.total_replies !== projectAnalytics.total_replies
      || lastSnapshot.total_hot_leads !== projectAnalytics.total_hot_leads
      || lastSnapshot.total_spend_usd !== projectAnalytics.total_spend_usd;
    if (movedSinceLast) {
      await supabase.from('explee_analytics_snapshots').insert({
        project_id: EXPLEE_PROJECT_ID,
        total_emails_sent: projectAnalytics.total_emails_sent,
        total_replies: projectAnalytics.total_replies,
        total_auto_replies: projectAnalytics.total_auto_replies,
        overall_reply_rate_pct: projectAnalytics.overall_reply_rate_pct,
        total_hot_leads: projectAnalytics.total_hot_leads,
        total_spend_usd: projectAnalytics.total_spend_usd,
      });
    }
  } catch (err) {
    console.error('[explee-outreach-sync] project analytics snapshot failed:', err);
  }

  return NextResponse.json({
    ok: true, partial, campaigns: campaigns.length, contacts_upserted: contactsUpserted,
    threads_fetched: threadsFetched, messages_stored: messagesStored, snapshot_recorded: movedSinceLast,
    campaign_errors: campaignErrors, thread_fetch_errors: threadFetchErrors, crm_imported: crmImported,
    stage_resynced: stageResynced,
  });
}

// Vercel Cron always invokes via GET (Authorization: Bearer CRON_SECRET);
// a manual trigger from /admin uses POST (x-cron-secret) — same as every
// other cron route in this app.
export const GET = withCronLogging('explee-outreach-sync', handle);
export const POST = withCronLogging('explee-outreach-sync', handle);
