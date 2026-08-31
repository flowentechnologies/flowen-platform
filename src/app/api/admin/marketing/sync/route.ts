/**
 * POST /api/admin/marketing/sync
 *
 * Pulls the last 30 days of campaign/ad-level stats from Meta Marketing API
 * and upserts into ad_platform_stats. Returns a summary of rows synced.
 *
 * Required env vars (add to Vercel):
 *   META_ADS_ACCESS_TOKEN  — long-lived system user access token with
 *                            ads_read + ads_management permissions
 *   META_AD_ACCOUNT_ID     — e.g. act_1234567890
 *
 * Safe to call multiple times — upsert is idempotent on (platform, stat_date,
 * campaign_id, adset_id, ad_id). Only syncs; never modifies ad spend, status,
 * targeting, bids, or creatives.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';

const META_API = 'https://graph.facebook.com/v22.0';

export async function POST(_req: NextRequest) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const token     = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) {
    return NextResponse.json({
      error: 'Meta credentials not configured',
      hint:  'Set META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID in Vercel environment variables.',
      configured: false,
    }, { status: 422 });
  }

  const client  = adminDb();
  const now     = new Date();
  const since   = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const until   = now.toISOString().slice(0, 10);

  // Fields to fetch from Meta Insights API
  const fields = [
    'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
    'ad_id', 'ad_name', 'creative',
    'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
    'ctr', 'cpc', 'cpm', 'frequency',
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
    ad_id?: string; ad_name?: string; creative?: { id?: string };
    date_start?: string; spend?: string; impressions?: string; reach?: string;
    clicks?: string; inline_link_clicks?: string; ctr?: string; cpc?: string;
    cpm?: string; frequency?: string;
  };

  const toPence = (s: string | undefined) =>
    s ? Math.round(parseFloat(s) * 100) : 0;

  const upsertRows = (allRows as MetaRow[]).map(r => ({
    platform:       'meta',
    stat_date:      r.date_start,
    campaign_id:    r.campaign_id  ?? null,
    campaign_name:  r.campaign_name ?? null,
    adset_id:       r.adset_id     ?? null,
    adset_name:     r.adset_name   ?? null,
    ad_id:          r.ad_id        ?? null,
    ad_name:        r.ad_name      ?? null,
    creative_id:    r.creative?.id ?? null,
    spend_pence:    toPence(r.spend),
    impressions:    parseInt(r.impressions ?? '0'),
    reach:          parseInt(r.reach       ?? '0'),
    clicks:         parseInt(r.clicks      ?? '0'),
    link_clicks:    parseInt(r.inline_link_clicks ?? '0'),
    ctr:            r.ctr       ? parseFloat(r.ctr)       : null,
    cpc_pence:      r.cpc       ? toPence(r.cpc)          : null,
    cpm_pence:      r.cpm       ? toPence(r.cpm)          : null,
    frequency:      r.frequency ? parseFloat(r.frequency) : null,
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
