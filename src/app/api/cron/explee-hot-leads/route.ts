/**
 * /api/cron/explee-hot-leads
 *
 * Pulls new hot leads from Explee (B2B outreach — finds prospects, emails
 * them, flags real-interest replies as "hot") and drops each one straight
 * into the Flowen CRM (crm_contacts, category='sales_lead') so they show up
 * in /admin/crm with zero manual copy-pasting. Runs every 10 minutes
 * (vercel.json).
 *
 * Watermark: instead of a separate cursor-state table, each run asks the DB
 * for max(became_hot_at) among contacts with source='explee' and passes
 * that as `since` to Explee. Self-healing — if a run is ever missed or a
 * row is manually edited, the next run just recomputes from what's
 * actually in the CRM rather than trusting stale external state. First
 * run ever (no explee rows yet) defaults to the last 24h so we don't
 * backfill the account's entire history.
 *
 * Scoped to project 33901 (flowen.digital): the hot-leads endpoint only
 * filters by campaign_id, not project_id, so each run first lists the
 * project's campaigns, then polls hot-leads per campaign_id. This means a
 * future second Explee project won't silently start feeding this project's
 * leads into our CRM, and a new campaign added to this project needs no
 * code change to be picked up.
 *
 * A contact that already exists (matched by email, e.g. an investor who
 * also happens to reply to a sales campaign) only has its enrichment
 * fields refreshed — category/stage/notes are never touched on an update,
 * so it doesn't clobber whatever pipeline stage a human has already moved
 * it to.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { adminDb as db } from '@/lib/supabase/admin';
import { withCronLogging } from '@/lib/cron-logging';

const EXPLEE_BASE = 'https://api.explee.com';
const EXPLEE_PROJECT_ID = 33901;
const PAGE_LIMIT = 200;
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

interface ExpleeCampaign {
  id: number;
  project_id: number;
  name: string;
}

interface ExpleeHotLead {
  person_id: string;
  campaign_id: number;
  name: string | null;
  email: string | null;
  job_title: string | null;
  company_name: string | null;
  company_domain: string | null;
  linkedin_url: string | null;
  country: string | null;
  phone: string | null;
  why_hot: string | null;
  became_hot_at: string | null;
}

interface ExpleeHotLeadsResponse {
  leads: ExpleeHotLead[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
}

function expleeHeaders(): HeadersInit {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) throw new Error('EXPLEE_API_KEY not configured');
  return { 'X-API-Key': key };
}

async function getProjectCampaignIds(): Promise<number[]> {
  const url = `${EXPLEE_BASE}/public/api/v1/autogtm/campaigns?project_id=${EXPLEE_PROJECT_ID}`;
  const res = await fetch(url, { headers: expleeHeaders() });
  if (!res.ok) throw new Error(`Explee campaigns list ${res.status}: ${await res.text()}`);
  const data = await res.json() as { campaigns: ExpleeCampaign[] };
  return data.campaigns.map(c => c.id);
}

async function fetchHotLeadsForCampaign(campaignId: number, since: string): Promise<ExpleeHotLead[]> {
  const leads: ExpleeHotLead[] = [];
  let offset = 0;
  for (;;) {
    const url = `${EXPLEE_BASE}/public/api/v1/autogtm/hot-leads?campaign_id=${campaignId}&since=${encodeURIComponent(since)}&limit=${PAGE_LIMIT}&offset=${offset}`;
    const res = await fetch(url, { headers: expleeHeaders() });
    if (!res.ok) throw new Error(`Explee hot-leads ${res.status}: ${await res.text()}`);
    const data = await res.json() as ExpleeHotLeadsResponse;
    leads.push(...data.leads);
    if (!data.has_more || data.next_offset === null) break;
    offset = data.next_offset;
  }
  return leads;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(req.headers)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = db();

  // ── Watermark ────────────────────────────────────────────────────────
  const { data: watermarkRow } = await supabase
    .from('crm_contacts')
    .select('became_hot_at')
    .eq('source', 'explee')
    .order('became_hot_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const since = watermarkRow?.became_hot_at ?? new Date(Date.now() - DEFAULT_LOOKBACK_MS).toISOString();

  // ── Fetch ────────────────────────────────────────────────────────────
  const campaignIds = await getProjectCampaignIds();
  const perCampaign = await Promise.all(campaignIds.map(id => fetchHotLeadsForCampaign(id, since)));
  const allLeads = perCampaign.flat();

  // Explee's schema allows a null email; we can't file a contact without
  // one, so skip those (rare — flag via the response for visibility).
  const withEmail = allLeads.filter((l): l is ExpleeHotLead & { email: string } => !!l.email);
  const skippedNoEmail = allLeads.length - withEmail.length;

  // Dedup within this batch (same person could appear on two pages if
  // became_hot_at ties land on a page boundary) — keep the most recent.
  const byEmail = new Map<string, ExpleeHotLead & { email: string }>();
  for (const lead of withEmail) {
    const key = lead.email.toLowerCase();
    const existing = byEmail.get(key);
    if (!existing || (lead.became_hot_at ?? '') > (existing.became_hot_at ?? '')) byEmail.set(key, lead);
  }
  const leads = [...byEmail.values()];

  if (leads.length === 0) {
    return NextResponse.json({ ok: true, checked_campaigns: campaignIds.length, since, new: 0, updated: 0, skipped_no_email: skippedNoEmail });
  }

  // ── Split new vs. already-known contacts ────────────────────────────
  const emails = leads.map(l => l.email.toLowerCase());
  const { data: existingRows } = await supabase.from('crm_contacts').select('id, email').in('email', emails);
  const existingByEmail = new Map((existingRows ?? []).map(r => [r.email.toLowerCase(), r.id as string]));

  let inserted = 0;
  let updated = 0;
  const newlyInsertedIds: string[] = [];

  for (const lead of leads) {
    const emailKey = lead.email.toLowerCase();
    const enrichment = {
      job_title: lead.job_title,
      company: lead.company_name,
      company_domain: lead.company_domain,
      linkedin_url: lead.linkedin_url,
      country: lead.country,
      phone: lead.phone,
      why_hot: lead.why_hot,
      became_hot_at: lead.became_hot_at,
      explee_person_id: lead.person_id,
      last_contact_at: lead.became_hot_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existingId = existingByEmail.get(emailKey);
    if (existingId) {
      // Refresh enrichment only — never touch category/stage/notes/source,
      // those are the human's own CRM workflow state.
      const { error } = await supabase.from('crm_contacts').update({
        name: lead.name ?? undefined,
        ...enrichment,
      }).eq('id', existingId);
      if (!error) updated++;
    } else {
      const { data: created, error } = await supabase.from('crm_contacts').insert({
        email: lead.email,
        name: lead.name,
        category: 'sales_lead',
        stage: 'new',
        source: 'explee',
        ...enrichment,
      }).select('id').single();
      if (!error && created) {
        inserted++;
        newlyInsertedIds.push(created.id as string);
      }
    }
  }

  // ── Notify the admin bell for genuinely new leads only ──────────────
  if (newlyInsertedIds.length > 0) {
    const { data: newContacts } = await supabase
      .from('crm_contacts').select('id, name, email, company')
      .in('id', newlyInsertedIds);
    for (const c of newContacts ?? []) {
      await supabase.from('admin_notifications').insert({
        type: 'crm_new',
        title: `🔥 New hot lead: ${c.name ?? c.email}`,
        body: c.company ?? c.email,
        link: `/admin/crm?contact=${c.id}`,
        priority: 'high',
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked_campaigns: campaignIds.length,
    since,
    new: inserted,
    updated,
    skipped_no_email: skippedNoEmail,
  });
}

// Vercel Cron always invokes via GET (Authorization: Bearer CRON_SECRET);
// a manual trigger from /admin uses POST (x-cron-secret) — same as every
// other cron route in this app.
export const GET = withCronLogging('explee-hot-leads', handle);
export const POST = withCronLogging('explee-hot-leads', handle);
