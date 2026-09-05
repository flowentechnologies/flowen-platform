/**
 * POST /api/admin/marketing/sync/google-ads
 *
 * Pulls last 30 days of campaign/ad-group/ad stats from Google Ads API v18
 * and upserts into ad_platform_stats (platform='google').
 * Idempotent — safe to call multiple times.
 *
 * Required env vars (add to Vercel):
 *   GOOGLE_ADS_DEVELOPER_TOKEN  — from Google Ads API Center
 *   GOOGLE_ADS_CUSTOMER_ID      — 10-digit account ID, no dashes (e.g. 1234567890)
 *   GOOGLE_CLIENT_ID            — OAuth2 client ID
 *   GOOGLE_CLIENT_SECRET        — OAuth2 client secret
 *   GOOGLE_REFRESH_TOKEN        — OAuth2 refresh token
 *
 * Optional:
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID — manager/MCC account ID if using MCC access
 *
 * Read-only: this route NEVER modifies bids, budgets, campaign status,
 * targeting, creatives, or any Google Ads settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin }               from '@/lib/admin/guard';
import { adminDb }                   from '@/lib/supabase/admin';
import { getGoogleAccessToken }      from '@/lib/google-oauth';
import { verifyCronRequest }         from '@/lib/cron-auth';

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v18';

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
    try { await assertAdmin(); } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const customerId     = process.env.GOOGLE_ADS_CUSTOMER_ID;          // digits only
  const loginId        = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;    // optional MCC

  if (!developerToken || !customerId) {
    return NextResponse.json({
      configured: false,
      error: 'Google Ads credentials not configured',
      hint:  'Set GOOGLE_ADS_DEVELOPER_TOKEN and GOOGLE_ADS_CUSTOMER_ID in Vercel environment variables.',
    }, { status: 422 });
  }

  // Check shared OAuth vars
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    return NextResponse.json({
      configured: false,
      error: 'Google OAuth credentials not configured',
      hint:  'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in Vercel environment variables.',
    }, { status: 422 });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken();
  } catch (e) {
    return NextResponse.json({ error: String(e), configured: true }, { status: 502 });
  }

  const now   = new Date();
  const since = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const until = now.toISOString().slice(0, 10);

  // GAQL query — campaign/adgroup/ad level with daily breakdown
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_ad.ad.id,
      ad_group_ad.ad.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.average_cpm,
      metrics.interactions,
      metrics.conversions,
      segments.date
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${since}' AND '${until}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND ad_group_ad.status != 'REMOVED'
    ORDER BY segments.date DESC
    LIMIT 10000
  `.trim();

  const headers: Record<string, string> = {
    'Authorization':  `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type':   'application/json',
  };
  if (loginId) headers['login-customer-id'] = loginId;

  let rawRows: unknown[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const body: Record<string, unknown> = { query };
      if (pageToken) body.pageToken = pageToken;

      const res  = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:search`, {
        method:  'POST',
        headers,
        body:    JSON.stringify(body),
      });
      const json = await res.json() as {
        results?: unknown[];
        nextPageToken?: string;
        error?: { message: string; status: string };
      };

      if (json.error) {
        return NextResponse.json({ error: json.error.message, status: json.error.status, configured: true }, { status: 502 });
      }

      rawRows   = [...rawRows, ...(json.results ?? [])];
      pageToken = json.nextPageToken;
    } while (pageToken && rawRows.length < 10000);
  } catch (e) {
    return NextResponse.json({ error: 'Google Ads API request failed', detail: String(e) }, { status: 502 });
  }

  if (rawRows.length === 0) {
    return NextResponse.json({ synced: 0, note: 'No Google Ads data returned for the date range.' });
  }

  // Transform Google Ads rows → ad_platform_stats schema
  type GAdsRow = {
    campaign?:    { id?: string; name?: string };
    adGroup?:     { id?: string; name?: string };
    adGroupAd?:   { ad?: { id?: string; name?: string } };
    metrics?: {
      costMicros?: string;          // micros (÷1,000,000 = GBP)
      impressions?: string;
      clicks?: string;
      ctr?: number;
      averageCpc?: string;          // micros
      averageCpm?: string;          // micros
      conversions?: number;
    };
    segments?: { date?: string };
  };

  // Google Ads uses micros (1,000,000 micros = 1 GBP)
  const microsToPence = (s: string | undefined) =>
    s ? Math.round(parseInt(s) / 10000) : 0;  // micros → pence

  const upsertRows = (rawRows as GAdsRow[]).map(r => ({
    platform:      'google',
    stat_date:     r.segments?.date ?? null,
    campaign_id:   r.campaign?.id   ?? null,
    campaign_name: r.campaign?.name ?? null,
    adset_id:      r.adGroup?.id    ?? null,
    adset_name:    r.adGroup?.name  ?? null,
    ad_id:         r.adGroupAd?.ad?.id   ?? null,
    ad_name:       r.adGroupAd?.ad?.name ?? null,
    creative_id:   null,                        // Google Ads creative IDs need a separate call
    spend_pence:   microsToPence(r.metrics?.costMicros),
    impressions:   parseInt(r.metrics?.impressions ?? '0'),
    reach:         0,                           // not available at ad level in Google Ads
    clicks:        parseInt(r.metrics?.clicks   ?? '0'),
    link_clicks:   parseInt(r.metrics?.clicks   ?? '0'),  // Google Ads clicks ≈ link clicks
    ctr:           r.metrics?.ctr       ?? null,
    cpc_pence:     microsToPence(r.metrics?.averageCpc),
    cpm_pence:     microsToPence(r.metrics?.averageCpm),
    frequency:     null,                        // not applicable in Google Ads
    leads:         Math.round(r.metrics?.conversions ?? 0),
    registrations: 0,                            // Google Ads reports one "conversions" metric, not separate lead/registration types
    synced_at:     new Date().toISOString(),
  }));

  // Upsert in batches of 100
  let synced = 0;
  const client = adminDb();
  const BATCH  = 100;
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const batch = upsertRows.slice(i, i + BATCH);
    const { error } = await client
      .from('ad_platform_stats')
      .upsert(batch, {
        onConflict:       'platform,stat_date,campaign_id,adset_id,ad_id',
        ignoreDuplicates: false,
      });
    if (error) {
      console.error('[sync/google-ads] upsert error:', error.message);
    } else {
      synced += batch.length;
    }
  }

  return NextResponse.json({
    synced,
    dateRange: { since, until },
    platform:  'google',
    note:      'Sync complete. Data-only read — no Google Ads changes were made.',
  });
}
