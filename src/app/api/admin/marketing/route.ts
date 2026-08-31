/**
 * GET /api/admin/marketing?section=<section>
 *
 * Central data API for the Marketing Intelligence dashboard.
 * Returns a section-specific payload; all data comes from Supabase (source of
 * truth for users/product) or Stripe (source of truth for payments). Ad
 * platform data is read from ad_platform_stats (populated by /sync endpoint).
 *
 * Sections: overview | paid_media | attribution | campaigns | creatives |
 *           social | tracking_health
 *
 * Recommendations are served from /api/admin/marketing/recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';

const db = adminDb;

// ── Helpers ───────────────────────────────────────────────────────────────────

function penceToGBP(pence: number) {
  return (pence / 100).toFixed(2);
}

function safeDivide(a: number, b: number): number | null {
  if (!b) return null;
  return a / b;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const section = req.nextUrl.searchParams.get('section') ?? 'overview';
  const client  = db();

  switch (section) {
    case 'overview':    return overview(client);
    case 'paid_media':  return paidMedia(client);
    case 'attribution': return attribution(client);
    case 'campaigns':   return campaigns(client);
    case 'creatives':   return creatives(client);
    case 'social':      return social(client);
    case 'tracking_health': return trackingHealth(client);
    default:
      return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  }
}

// ── Overview ──────────────────────────────────────────────────────────────────

async function overview(client: ReturnType<typeof adminDb>) {
  const now = new Date();

  const [
    waitlistRes, profilesRes, onboardedRes,
    firstSessionRes, activeSubsRes, adStatsRes,
    visitorRes,
  ] = await Promise.all([
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_complete', true),
    // users with ≥1 practice session (distinct)
    client.from('practice_sessions').select('user_id').limit(10000),
    client.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    // ad spend totals (all time)
    client.from('ad_platform_stats').select('spend_pence, impressions, clicks, link_clicks, platform').limit(10000),
    // visitor sessions (proxy to "landing page visits")
    client.from('visitor_sessions').select('*', { count: 'exact', head: true }),
  ]);

  const waitlist  = waitlistRes.count   ?? 0;
  const accounts  = profilesRes.count   ?? 0;
  const onboarded = onboardedRes.count  ?? 0;
  const paidUsers = activeSubsRes.count ?? 0;
  const landingVisits = visitorRes.count ?? 0;

  // Activated = distinct users with ≥1 session
  const sessionRows = (firstSessionRes.data ?? []) as { user_id: string }[];
  const activated   = new Set(sessionRows.map(r => r.user_id)).size;

  // Ad totals
  const adRows = (adStatsRes.data ?? []) as {
    spend_pence: number; impressions: number; clicks: number; link_clicks: number; platform: string;
  }[];
  const totalSpend = adRows.reduce((s, r) => s + (r.spend_pence ?? 0), 0);

  const funnel = [
    { stage: 'Ad Impressions',   count: adRows.reduce((s, r) => s + r.impressions, 0), note: 'from ad platform stats' },
    { stage: 'Ad Clicks',        count: adRows.reduce((s, r) => s + r.clicks, 0),      note: 'from ad platform stats' },
    { stage: 'Landing Page',     count: landingVisits,  note: 'unique visitor sessions' },
    { stage: 'Waitlist',         count: waitlist,        note: 'waitlist_signups table' },
    { stage: 'Account Created',  count: accounts,        note: 'profiles table' },
    { stage: 'Onboarding Done',  count: onboarded,       note: 'onboarding_complete = true' },
    { stage: 'First Session',    count: activated,       note: 'distinct users with ≥1 practice session' },
    { stage: 'Activated',        count: activated,       note: 'same as first session' },
    { stage: 'Paid',             count: paidUsers,       note: 'active Stripe subscriptions' },
  ];

  // CPA calculations — correctly labelled
  const waitlistCPA   = safeDivide(totalSpend, waitlist);    // pence per waitlist user
  const activatedCPA  = safeDivide(totalSpend, activated);
  const trueCAC       = safeDivide(totalSpend, paidUsers);

  // Active campaigns (distinct campaign IDs in ad_platform_stats from last 30d)
  const last30 = new Date(now.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data: recentCampaigns } = await client
    .from('ad_platform_stats')
    .select('campaign_id')
    .gte('stat_date', last30)
    .not('campaign_id', 'is', null);
  const activeCampaigns = new Set((recentCampaigns ?? []).map((r: { campaign_id: string }) => r.campaign_id)).size;

  const { data: lastSync } = await client
    .from('ad_platform_stats')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    funnel,
    totalSpendPence: totalSpend,
    totalSpendGBP:   penceToGBP(totalSpend),
    // ⚠ Labelling rules: never call waitlist CPA "CAC"
    waitlistCPAPence:   waitlistCPA,
    activatedCPAPence:  activatedCPA,
    trueCAC_pence:      trueCAC,
    waitlistCPALabel:   'Early Observed Waitlist CPA',
    activatedCPALabel:  'Activated User CPA',
    trueCACLabel:       'True CAC (Paying Users)',
    // Baseline observed data (£4.13 spend / 7 waitlist)
    baseline: {
      note: 'Early observed baseline — small sample, not statistically significant',
      spendGBP: '4.13',
      waitlistUsers: 7,
      observedCPA: '0.59',
    },
    activeCampaigns,
    lastSyncAt: lastSync?.synced_at ?? null,
  });
}

// ── Paid Media ────────────────────────────────────────────────────────────────

async function paidMedia(client: ReturnType<typeof adminDb>) {
  const [adRes, waitlistRes, activeSubRes, sessionRes] = await Promise.all([
    client.from('ad_platform_stats')
      .select('platform, stat_date, campaign_id, campaign_name, spend_pence, impressions, reach, clicks, link_clicks, ctr, cpc_pence, cpm_pence')
      .order('stat_date', { ascending: false })
      .limit(500),
    client.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    client.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    client.from('practice_sessions').select('user_id').limit(10000),
  ]);

  type AdRow = {
    platform: string; stat_date: string; campaign_id: string | null; campaign_name: string | null;
    spend_pence: number; impressions: number; reach: number; clicks: number; link_clicks: number;
    ctr: number | null; cpc_pence: number | null; cpm_pence: number | null;
  };

  const rows      = (adRes.data ?? []) as AdRow[];
  const waitlist  = waitlistRes.count ?? 0;
  const paidUsers = activeSubRes.count ?? 0;
  const activated = new Set(((sessionRes.data ?? []) as { user_id: string }[]).map(r => r.user_id)).size;

  // Aggregate by platform
  const byPlatform: Record<string, {
    platform: string; spendPence: number; impressions: number; reach: number;
    clicks: number; linkClicks: number; rows: number;
  }> = {};

  for (const r of rows) {
    if (!byPlatform[r.platform]) {
      byPlatform[r.platform] = { platform: r.platform, spendPence: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, rows: 0 };
    }
    const p = byPlatform[r.platform];
    p.spendPence  += r.spend_pence ?? 0;
    p.impressions += r.impressions ?? 0;
    p.reach       += r.reach       ?? 0;
    p.clicks      += r.clicks      ?? 0;
    p.linkClicks  += r.link_clicks ?? 0;
    p.rows++;
  }

  const platforms = Object.values(byPlatform).map(p => ({
    ...p,
    spendGBP:     penceToGBP(p.spendPence),
    ctr:          p.impressions > 0 ? ((p.clicks / p.impressions) * 100).toFixed(3) : null,
    cpcGBP:       p.clicks > 0     ? penceToGBP(Math.round(p.spendPence / p.clicks)) : null,
    cpmGBP:       p.impressions > 0 ? penceToGBP(Math.round((p.spendPence / p.impressions) * 1000)) : null,
  }));

  const totalSpend = rows.reduce((s, r) => s + (r.spend_pence ?? 0), 0);

  // Daily spend (last 30 days)
  const last30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const dailySpend: Record<string, number> = {};
  for (const r of rows.filter(r => r.stat_date >= last30)) {
    dailySpend[r.stat_date] = (dailySpend[r.stat_date] ?? 0) + r.spend_pence;
  }

  return NextResponse.json({
    platforms,
    totalSpendGBP: penceToGBP(totalSpend),
    totalSpendPence: totalSpend,
    dailySpend,
    // Correctly labelled CPAs — NEVER call waitlist CPA "CAC"
    metrics: {
      waitlistCPA: {
        label: 'Early Observed Waitlist CPA',
        valueGBP: totalSpend && waitlist ? penceToGBP(Math.round(totalSpend / waitlist)) : null,
        note: 'Spend ÷ Waitlist sign-ups. Not CAC — waitlist users have not paid.',
        sampleSize: waitlist,
      },
      activatedCPA: {
        label: 'Activated User CPA',
        valueGBP: totalSpend && activated ? penceToGBP(Math.round(totalSpend / activated)) : null,
        note: 'Spend ÷ users who completed ≥1 practice session.',
        sampleSize: activated,
      },
      trueCAC: {
        label: 'True CAC (Paying Users)',
        valueGBP: totalSpend && paidUsers ? penceToGBP(Math.round(totalSpend / paidUsers)) : null,
        note: 'Spend ÷ active paying subscribers. The only metric that is CAC.',
        sampleSize: paidUsers,
      },
    },
    baseline: {
      note: 'Early campaign baseline observed — £4.13 spend, 7 waitlist sign-ups',
      spendGBP: '4.13',
      waitlistUsers: 7,
      cpaGBP: '0.59',
    },
    supportedPlatforms: ['meta', 'google'],
    activePlatforms: [...new Set(rows.map(r => r.platform))],
  });
}

// ── Attribution ───────────────────────────────────────────────────────────────

async function attribution(client: ReturnType<typeof adminDb>) {
  const [attrRes, profilesCountRes, visitorRes] = await Promise.all([
    client.from('marketing_attribution')
      .select('anonymous_id, user_id, utm_source, utm_medium, utm_campaign, fbclid, gclid, landing_page, referrer, first_seen_at, converted_at, conversion_type')
      .order('first_seen_at', { ascending: false })
      .limit(500),
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('visitor_sessions')
      .select('utm_source, utm_medium, utm_campaign')
      .limit(5000),
  ]);

  type AttrRow = {
    anonymous_id: string; user_id: string | null; utm_source: string | null;
    utm_medium: string | null; utm_campaign: string | null; fbclid: string | null;
    gclid: string | null; landing_page: string | null; referrer: string | null;
    first_seen_at: string; converted_at: string | null; conversion_type: string | null;
  };

  const rows       = (attrRes.data ?? []) as AttrRow[];
  const totalUsers = profilesCountRes.count ?? 0;
  const attributed = rows.filter(r => r.user_id !== null).length;
  const converted  = rows.filter(r => r.converted_at !== null).length;

  // Source breakdown
  const bySource: Record<string, { source: string; clicks: number; conversions: number }> = {};
  for (const r of rows) {
    const src = r.utm_source ?? r.fbclid ? 'meta' : r.gclid ? 'google' : 'direct';
    if (!bySource[src]) bySource[src] = { source: src, clicks: 0, conversions: 0 };
    bySource[src].clicks++;
    if (r.converted_at) bySource[src].conversions++;
  }

  // Campaign breakdown
  const byCampaign: Record<string, { campaign: string; clicks: number; conversions: number }> = {};
  for (const r of rows.filter(r => r.utm_campaign)) {
    const c = r.utm_campaign!;
    if (!byCampaign[c]) byCampaign[c] = { campaign: c, clicks: 0, conversions: 0 };
    byCampaign[c].clicks++;
    if (r.converted_at) byCampaign[c].conversions++;
  }

  // Visitor UTM coverage
  const visitorRows = (visitorRes.data ?? []) as { utm_source: string | null }[];
  const withUTM  = visitorRows.filter(r => r.utm_source).length;
  const utmCoverage = visitorRows.length > 0
    ? Math.round((withUTM / visitorRows.length) * 100)
    : null;

  return NextResponse.json({
    totalRows:       rows.length,
    attributed,
    converted,
    unattributed:    totalUsers - attributed,
    bySource:        Object.values(bySource).sort((a, b) => b.clicks - a.clicks),
    byCampaign:      Object.values(byCampaign).sort((a, b) => b.conversions - a.conversions).slice(0, 20),
    recentSamples:   rows.slice(0, 25).map(r => ({
      source:          r.utm_source,
      medium:          r.utm_medium,
      campaign:        r.utm_campaign,
      hasClickId:      !!(r.fbclid || r.gclid),
      landingPage:     r.landing_page,
      firstSeen:       r.first_seen_at,
      converted:       !!r.converted_at,
      conversionType:  r.conversion_type,
      linked:          !!r.user_id,
    })),
    utmCoveragePercent: utmCoverage,
    note: 'First-touch attribution is permanent and never overwritten. Last-touch stored separately via conversion_type updates.',
  });
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

async function campaigns(client: ReturnType<typeof adminDb>) {
  const { data: rows } = await client
    .from('ad_platform_stats')
    .select('platform, stat_date, campaign_id, campaign_name, spend_pence, impressions, reach, clicks, link_clicks, ctr, cpc_pence, cpm_pence, synced_at')
    .order('stat_date', { ascending: false })
    .limit(1000);

  type CamRow = {
    platform: string; stat_date: string; campaign_id: string | null; campaign_name: string | null;
    spend_pence: number; impressions: number; reach: number; clicks: number; link_clicks: number;
    ctr: number | null; cpc_pence: number | null; cpm_pence: number | null; synced_at: string;
  };

  const all = (rows ?? []) as CamRow[];

  // Roll up by campaign
  const byCampaign: Record<string, {
    campaignId: string; campaignName: string | null; platform: string;
    spendPence: number; impressions: number; reach: number; clicks: number; linkClicks: number;
    dates: string[]; lastSynced: string;
  }> = {};

  for (const r of all) {
    const key = `${r.platform}::${r.campaign_id ?? 'unknown'}`;
    if (!byCampaign[key]) {
      byCampaign[key] = {
        campaignId: r.campaign_id ?? 'unknown', campaignName: r.campaign_name,
        platform: r.platform, spendPence: 0, impressions: 0, reach: 0,
        clicks: 0, linkClicks: 0, dates: [], lastSynced: r.synced_at,
      };
    }
    const c = byCampaign[key];
    c.spendPence  += r.spend_pence ?? 0;
    c.impressions += r.impressions ?? 0;
    c.reach       += r.reach       ?? 0;
    c.clicks      += r.clicks      ?? 0;
    c.linkClicks  += r.link_clicks ?? 0;
    c.dates.push(r.stat_date);
    if (r.synced_at > c.lastSynced) c.lastSynced = r.synced_at;
  }

  const campaignList = Object.values(byCampaign).map(c => ({
    ...c,
    spendGBP:   penceToGBP(c.spendPence),
    ctr:        c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(3) : null,
    cpcGBP:     c.clicks > 0     ? penceToGBP(Math.round(c.spendPence / c.clicks)) : null,
    cpmGBP:     c.impressions > 0 ? penceToGBP(Math.round((c.spendPence / c.impressions) * 1000)) : null,
    dateRange:  c.dates.length > 0
      ? { from: c.dates.sort()[0], to: c.dates.sort().slice(-1)[0] }
      : null,
  })).sort((a, b) => b.spendPence - a.spendPence);

  const lastSynced = all.length > 0
    ? all.reduce((best, r) => r.synced_at > best ? r.synced_at : best, all[0].synced_at)
    : null;

  return NextResponse.json({ campaigns: campaignList, lastSyncAt: lastSynced, totalRows: all.length });
}

// ── Creatives ─────────────────────────────────────────────────────────────────

async function creatives(client: ReturnType<typeof adminDb>) {
  const { data: rows } = await client
    .from('ad_platform_stats')
    .select('platform, ad_id, ad_name, creative_id, spend_pence, impressions, clicks, link_clicks, ctr, cpc_pence')
    .not('ad_id', 'is', null)
    .order('spend_pence', { ascending: false })
    .limit(200);

  type CreativeRow = {
    platform: string; ad_id: string; ad_name: string | null; creative_id: string | null;
    spend_pence: number; impressions: number; clicks: number; link_clicks: number;
    ctr: number | null; cpc_pence: number | null;
  };

  const all = (rows ?? []) as CreativeRow[];

  // Roll up by ad_id
  const byAd: Record<string, {
    adId: string; adName: string | null; creativeId: string | null; platform: string;
    spendPence: number; impressions: number; clicks: number; linkClicks: number;
  }> = {};

  for (const r of all) {
    if (!byAd[r.ad_id]) {
      byAd[r.ad_id] = {
        adId: r.ad_id, adName: r.ad_name, creativeId: r.creative_id,
        platform: r.platform, spendPence: 0, impressions: 0, clicks: 0, linkClicks: 0,
      };
    }
    const a = byAd[r.ad_id];
    a.spendPence  += r.spend_pence ?? 0;
    a.impressions += r.impressions ?? 0;
    a.clicks      += r.clicks      ?? 0;
    a.linkClicks  += r.link_clicks ?? 0;
  }

  const creativeList = Object.values(byAd).map(a => ({
    ...a,
    spendGBP: penceToGBP(a.spendPence),
    ctr:      a.impressions > 0 ? ((a.clicks / a.impressions) * 100).toFixed(3) : null,
    cpcGBP:   a.clicks > 0     ? penceToGBP(Math.round(a.spendPence / a.clicks)) : null,
  })).sort((a, b) => b.spendPence - a.spendPence);

  return NextResponse.json({ creatives: creativeList });
}

// ── Social ────────────────────────────────────────────────────────────────────

async function social(client: ReturnType<typeof adminDb>) {
  const [statsRes, postsRes] = await Promise.all([
    client.from('social_platform_stats').select('*').order('stat_date', { ascending: false }).limit(300),
    client.from('social_posts').select('*').order('published_at', { ascending: false }).limit(100),
  ]);

  type StatRow = {
    platform: string; stat_date: string; followers: number | null; follower_delta: number | null;
    reach: number | null; impressions: number | null; views: number | null;
    likes: number | null; comments: number | null; shares: number | null;
    saves: number | null; engagement_rate: number | null; website_clicks: number | null;
    profile_visits: number | null; watch_time_secs: number | null;
    attributed_waitlist: number | null;
  };

  const stats = (statsRes.data ?? []) as StatRow[];
  const posts = (postsRes.data ?? []) as Record<string, unknown>[];

  // Latest snapshot per platform
  const latestByPlatform: Record<string, StatRow> = {};
  for (const s of stats) {
    if (!latestByPlatform[s.platform] || s.stat_date > latestByPlatform[s.platform].stat_date) {
      latestByPlatform[s.platform] = s;
    }
  }

  const supportedPlatforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x'];

  return NextResponse.json({
    platforms: supportedPlatforms.map(p => ({
      platform: p,
      latest:   latestByPlatform[p] ?? null,
      history:  stats.filter(s => s.platform === p).slice(0, 30),
    })),
    posts,
    hasSyncedData: stats.length > 0,
  });
}

// ── Tracking Health ───────────────────────────────────────────────────────────

async function trackingHealth(client: ReturnType<typeof adminDb>) {
  const [
    profilesRes, attrRes, visitorRes, subRes, adSyncRes, trackingRes,
  ] = await Promise.all([
    client.from('profiles').select('*', { count: 'exact', head: true }),
    client.from('marketing_attribution')
      .select('user_id, utm_source, utm_medium, utm_campaign, first_seen_at, converted_at'),
    client.from('visitor_sessions')
      .select('utm_source, created_at')
      .order('created_at', { ascending: false })
      .limit(5000),
    // Last Stripe webhook signal: look for recent subscription with updated_at
    client.from('subscriptions')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
    // Last ad platform sync
    client.from('ad_platform_stats')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single(),
    // Tracking providers config — active platforms only
    client.from('tracking_providers')
      .select('provider_key, enabled, pixel_id, server_config')
      .in('provider_key', ['meta', 'ga4']),
  ]);

  type VisitorRow  = { utm_source: string | null; created_at: string };
  type AttrRow     = { user_id: string | null; utm_source: string | null; utm_campaign: string | null; converted_at: string | null };
  type TrackingRow = { provider_key: string; enabled: boolean; pixel_id: string | null; server_config: Record<string,unknown> };

  const totalUsers  = profilesRes.count ?? 0;
  const attrRows    = (attrRes.data    ?? []) as AttrRow[];
  const visitorRows = (visitorRes.data ?? []) as VisitorRow[];
  const providers   = (trackingRes.data ?? []) as TrackingRow[];

  const linkedAttr    = attrRows.filter(r => r.user_id !== null).length;
  const withUTM_attr  = attrRows.filter(r => r.utm_source !== null).length;
  const withUTM_vis   = visitorRows.filter(r => r.utm_source !== null).length;
  const unattributed  = totalUsers - linkedAttr;

  // UTM coverage on visitor sessions (last 5000)
  const utmCoverage = visitorRows.length > 0
    ? Math.round((withUTM_vis / visitorRows.length) * 100)
    : null;

  // Attribution coverage (% of all-time users with a linked attribution row)
  const attrCoverage = totalUsers > 0
    ? Math.round((linkedAttr / totalUsers) * 100)
    : null;

  // Provider status — Meta Pixel + GA4 are the active tracking integrations
  const providerStatus = (['meta', 'ga4'] as const).map(key => {
    const p = providers.find(r => r.provider_key === key);
    return {
      provider: key,
      enabled:  p?.enabled ?? false,
      hasPixel: !!(p?.pixel_id),
      hasCapiToken: !!(p?.server_config?.capi_token),
    };
  });

  const events = [
    { event: 'Ad click → attribution row',    status: attrRows.length > 0 ? 'ok' : 'no_data' },
    { event: 'Attribution → user link',        status: linkedAttr > 0 ? 'ok' : 'no_data' },
    { event: 'UTM coverage (visitor sessions)',status: utmCoverage !== null && utmCoverage > 0 ? 'ok' : 'no_data' },
    { event: 'Stripe subscription sync',       status: subRes.data?.updated_at ? 'ok' : 'no_data' },
    { event: 'Ad platform data sync',          status: adSyncRes.data?.synced_at ? 'ok' : 'not_synced' },
    { event: 'Meta Pixel configured',          status: providerStatus.find(p => p.provider === 'meta')?.enabled ? 'ok' : 'not_configured' },
  ];

  return NextResponse.json({
    events,
    utmCoveragePercent:   utmCoverage,
    attrCoveragePercent:  attrCoverage,
    unattributedUsers:    unattributed,
    totalAttributionRows: attrRows.length,
    linkedAttributionRows: linkedAttr,
    lastStripeSync:       subRes.data?.updated_at ?? null,
    lastAdSync:           adSyncRes.data?.synced_at ?? null,
    providers:            providerStatus,
    totalVisitorSessions: visitorRows.length,
  });
}
