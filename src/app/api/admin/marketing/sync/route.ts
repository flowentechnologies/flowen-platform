/**
 * POST /api/admin/marketing/sync
 *
 * Pulls the last 30 days of campaign/ad-level stats from Meta Marketing API
 * and upserts into ad_platform_stats. Returns a summary of rows synced.
 *
 * Required env vars (add to Vercel):
 *   META_ADS_ACCESS_TOKEN or META_ACCESS_TOKEN — long-lived system user
 *                            access token with ads_read + ads_management
 *                            permissions. This route previously only
 *                            checked META_ADS_ACCESS_TOKEN, which was never
 *                            actually set — the token that *was* configured
 *                            (META_ACCESS_TOKEN, already used elsewhere for
 *                            CAPI/social publishing) is why this sync never
 *                            ran successfully. Falls back to it now.
 *   META_AD_ACCOUNT_ID     — e.g. act_1234567890
 *
 * Also captures `actions` (Lead, CompleteRegistration, etc.) alongside
 * spend/clicks — needed so /admin/consistency can compare what Meta reports
 * as conversions against real signups in Flowen's own database, which is
 * the exact "41 reported leads vs 8 real signups" gap this exists to catch
 * automatically going forward.
 *
 * Safe to call multiple times — upsert is idempotent on (platform, stat_date,
 * campaign_id, adset_id, ad_id). Only syncs; never modifies ad spend, status,
 * targeting, bids, or creatives.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { verifyCronRequest } from '@/lib/cron-auth';

const META_API = 'https://graph.facebook.com/v22.0';

// Accepts either an admin browser session (manual "Sync now" click) or the
// cron secret (scheduled daily run, or /admin/cron's manual-trigger button)
// — previously admin-session-only, which meant no cron could ever run this.
// GET is required too: Vercel Cron always invokes via GET.
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  if (!verifyCronRequest(req.headers)) {
    try {
      await assertAdmin();
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const token     = process.env.META_ADS_ACCESS_TOKEN ?? process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    return NextResponse.json({
      error: 'Meta credentials not configured',
      hint:  'Set META_ADS_ACCESS_TOKEN (or META_ACCESS_TOKEN) and META_AD_ACCOUNT_ID in Vercel environment variables.',
      configured: false,
    }, { status: 422 });
  }

  const client  = adminDb();
  const now     = new Date();
  const since   = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const until   = now.toISOString().slice(0, 10);

  // Fields to fetch from Meta Insights API. `creative` is NOT a valid
  // Insights field (Insights returns performance metrics, not creative
  // objects — this was a pre-existing bug, the actual reason this sync
  // never once succeeded even before the token-name issue: Meta rejects
  // the whole request with "(#100) creative is not valid for fields
  // param"). Creative ID would need a separate call against the ad
  // object itself; not worth the extra request for what this feeds
  // (the consistency check only needs spend/leads/registrations).
  const fields = [
    'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
    'ad_id', 'ad_name',
    'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
    'ctr', 'cpc', 'cpm', 'frequency', 'actions',
  ].join(',');

  const params = new URLSearchParams({
    access_token: token,
    level:        'ad',
    fields,
    time_range:   JSON.stringify({ since, until }),
    time_increment: '1',      // daily breakdown
    limit:        '500',
  });

  let allRows: unknown[] = [];
  let nextUrl: string | null = `${META_API}/${accountId}/insights?${params}`;

  try {
    while (nextUrl) {
      const res  = await fetch(nextUrl);
      const json = await res.json() as { data?: unknown[]; paging?: { next?: string }; error?: { message: string } };
      if (json.error) {
        return NextResponse.json({ error: json.error.message, configured: true }, { status: 502 });
      }
      allRows = [...allRows, ...(json.data ?? [])];
      nextUrl = json.paging?.next ?? null;
      if (allRows.length > 5000) break; // safety cap
    }
  } catch (e) {
    return NextResponse.json({ error: 'Meta API request failed', detail: String(e) }, { status: 502 });
  }

  if (allRows.length === 0) {
    return NextResponse.json({ synced: 0, note: 'No data returned from Meta for the date range.' });
  }

  // Transform Meta rows → ad_platform_stats schema
  type MetaRow = {
    campaign_id?: string; campaign_name?: string; adset_id?: string; adset_name?: string;
    ad_id?: string; ad_name?: string;
    date_start?: string; spend?: string; impressions?: string; reach?: string;
    clicks?: string; inline_link_clicks?: string; ctr?: string; cpc?: string;
    cpm?: string; frequency?: string;
    actions?: { action_type: string; value: string }[];
  };

  const toPence = (s: string | undefined) =>
    s ? Math.round(parseFloat(s) * 100) : 0;

  // Meta's own conversion action types, distinct from landing_page_view
  // (which is a page load, not a lead — the exact metric that got
  // mistaken for "41 leads" before this existed).
  const LEAD_ACTION_TYPES = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
  const REGISTRATION_ACTION_TYPES = ['offsite_conversion.fb_pixel_complete_registration', 'complete_registration'];

  function sumActions(actions: { action_type: string; value: string }[] | undefined, types: string[]): number {
    if (!actions) return 0;
    return actions.filter(a => types.includes(a.action_type)).reduce((sum, a) => sum + (parseInt(a.value) || 0), 0);
  }

  const upsertRows = (allRows as MetaRow[]).map(r => ({
    platform:       'meta',
    stat_date:      r.date_start,
    campaign_id:    r.campaign_id  ?? null,
    campaign_name:  r.campaign_name ?? null,
    adset_id:       r.adset_id     ?? null,
    adset_name:     r.adset_name   ?? null,
    ad_id:          r.ad_id        ?? null,
    ad_name:        r.ad_name      ?? null,
    creative_id:    null, // Meta Insights doesn't return creative objects; would need a separate ad-object call
    spend_pence:    toPence(r.spend),
    impressions:    parseInt(r.impressions ?? '0'),
    reach:          parseInt(r.reach       ?? '0'),
    clicks:         parseInt(r.clicks      ?? '0'),
    link_clicks:    parseInt(r.inline_link_clicks ?? '0'),
    ctr:            r.ctr       ? parseFloat(r.ctr)       : null,
    cpc_pence:      r.cpc       ? toPence(r.cpc)          : null,
    cpm_pence:      r.cpm       ? toPence(r.cpm)          : null,
    frequency:      r.frequency ? parseFloat(r.frequency) : null,
    leads:          sumActions(r.actions, LEAD_ACTION_TYPES),
    registrations:  sumActions(r.actions, REGISTRATION_ACTION_TYPES),
    synced_at:      new Date().toISOString(),
  }));

  // Upsert in batches of 100
  let synced = 0;
  const BATCH = 100;
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const batch = upsertRows.slice(i, i + BATCH);
    const { error } = await client
      .from('ad_platform_stats')
      .upsert(batch, {
        onConflict: 'platform,stat_date,campaign_id,adset_id,ad_id',
        ignoreDuplicates: false,
      });
    if (error) {
      console.error('[marketing/sync] upsert error:', error.message);
    } else {
      synced += batch.length;
    }
  }

  return NextResponse.json({
    synced,
    dateRange: { since, until },
    platform: 'meta',
    note: 'Sync complete. Data-only read — no ad changes were made.',
  });
}
