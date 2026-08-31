/**
 * POST /api/admin/marketing/sync/google-analytics
 *
 * Pulls last 30 days of traffic data from GA4 Data API v1beta
 * and upserts into google_analytics_stats, keyed by
 * (property_id, stat_date, source, medium, campaign).
 * Idempotent — safe to call multiple times.
 *
 * Required env vars (add to Vercel):
 *   GOOGLE_ANALYTICS_PROPERTY_ID — GA4 numeric property ID (e.g. 123456789)
 *   GOOGLE_CLIENT_ID             — OAuth2 client ID (shared with Google Ads)
 *   GOOGLE_CLIENT_SECRET         — OAuth2 client secret
 *   GOOGLE_REFRESH_TOKEN         — OAuth2 refresh token
 *
 * Read-only: this route NEVER modifies any GA4 settings, goals, or data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin }               from '@/lib/admin/guard';
import { adminDb }                   from '@/lib/supabase/admin';
import { getGoogleAccessToken }      from '@/lib/google-oauth';

const GA4_API = 'https://analyticsdata.googleapis.com/v1beta';

export async function POST(_req: NextRequest) {
  try { await assertAdmin(); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

  if (!propertyId) {
    return NextResponse.json({
      configured: false,
      error: 'GA4 not configured',
      hint:  'Set GOOGLE_ANALYTICS_PROPERTY_ID in Vercel environment variables.',
    }, { status: 422 });
  }

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

  // GA4 Data API — daily breakdown by source/medium/campaign
  const body = {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'conversions' },
      { name: 'screenPageViews' },
    ],
    limit: 10000,
  };

  let rows: unknown[] = [];
  let offset          = 0;

  try {
    do {
      const res  = await fetch(`${GA4_API}/properties/${propertyId}:runReport`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ ...body, offset }),
      });

      const json = await res.json() as {
        rows?:      { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
        rowCount?:  number;
        error?:     { message: string; status: string };
      };

      if (json.error) {
        return NextResponse.json({ error: json.error.message, status: json.error.status, configured: true }, { status: 502 });
      }

      const page = json.rows ?? [];
      rows       = [...rows, ...page];
      offset    += page.length;

      // Done if we got fewer rows than requested
      if (page.length < 10000) break;
    } while (rows.length < 50000); // hard safety cap
  } catch (e) {
    return NextResponse.json({ error: 'GA4 API request failed', detail: String(e) }, { status: 502 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ synced: 0, note: 'No GA4 data returned for the date range.' });
  }

  type GA4Row = {
    dimensionValues: { value: string }[];
    metricValues:    { value: string }[];
  };

  // Dimensions order: date, sessionSource, sessionMedium, sessionCampaignName
  // Metrics order:    sessions, totalUsers, newUsers, bounceRate, avgSessionDuration, conversions, screenPageViews
  const upsertRows = (rows as GA4Row[]).map(r => {
    const [date, source, medium, campaign] = r.dimensionValues.map(d => d.value);
    const [sessions, totalUsers, newUsers, bounceRate, avgDuration, conversions, pageViews] =
      r.metricValues.map(m => m.value);

    // GA4 dates are YYYYMMDD — convert to YYYY-MM-DD
    const statDate = date.length === 8
      ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
      : date;

    return {
      property_id:           propertyId,
      stat_date:             statDate,
      source:                source === '(not set)' ? null : source,
      medium:                medium === '(not set)' ? null : medium,
      campaign:              campaign === '(not set)' ? null : campaign,
      sessions:              parseInt(sessions)   || 0,
      users:                 parseInt(totalUsers) || 0,
      new_users:             parseInt(newUsers)   || 0,
      bounce_rate:           parseFloat(bounceRate)  || null,
      avg_session_duration:  parseFloat(avgDuration) || null,
      conversions:           parseInt(conversions)   || 0,
      page_views:            parseInt(pageViews)     || 0,
      synced_at:             new Date().toISOString(),
    };
  });

  const client = adminDb();
  let synced   = 0;
  const BATCH  = 200;

  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const batch = upsertRows.slice(i, i + BATCH);
    const { error } = await client
      .from('google_analytics_stats')
      .upsert(batch, {
        onConflict:       'property_id,stat_date,source,medium,campaign',
        ignoreDuplicates: false,
      });
    if (error) {
      console.error('[sync/google-analytics] upsert error:', error.message);
    } else {
      synced += batch.length;
    }
  }

  return NextResponse.json({
    synced,
    dateRange: { startDate: '30daysAgo', endDate: 'today' },
    propertyId,
    note: 'Sync complete. Read-only — no GA4 settings were changed.',
  });
}
