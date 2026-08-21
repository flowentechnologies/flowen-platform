import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';

export type LiveRange = '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | '6m' | '12m';
export type BucketType = 'time' | 'date' | 'week' | 'month';

// ── Geo coordinate lookups ─────────────────────────────────────────────────────

const COUNTRY_COORDS: Record<string, [number, number]> = {
  GB: [51.5, -0.13],   US: [37.09, -95.71],  CA: [56.13, -106.35],
  AU: [-25.27, 133.78], IE: [53.41, -8.24],   DE: [51.17, 10.45],
  FR: [46.23, 2.21],   IN: [20.59, 78.96],   NL: [52.13, 5.29],
  SE: [60.13, 18.64],  NO: [60.47, 8.47],    DK: [56.26, 9.5],
  FI: [61.92, 25.75],  AT: [47.52, 14.55],   CH: [46.82, 8.23],
  BE: [50.5, 4.47],    ES: [40.46, -3.75],   IT: [41.87, 12.57],
  PL: [51.92, 19.15],  CZ: [49.82, 15.47],   JP: [36.2, 138.25],
  KR: [35.91, 127.77], CN: [35.86, 104.2],   SG: [1.35, 103.82],
  MY: [4.21, 108.97],  ID: [-0.79, 113.92],  TH: [15.87, 100.99],
  AE: [23.42, 53.85],  ZA: [-30.56, 22.94],  NG: [9.08, 8.68],
  KE: [-0.02, 37.91],  BR: [-14.24, -51.93], AR: [-38.42, -63.62],
  MX: [23.63, -102.55],CO: [4.57, -74.3],    PE: [-9.19, -75.02],
  NZ: [-40.9, 174.89], PT: [39.4, -8.22],    GR: [39.07, 21.82],
  HU: [47.16, 19.5],   RO: [45.94, 24.97],   UA: [48.38, 31.17],
  RU: [61.52, 105.32], TR: [38.96, 35.24],   EG: [26.82, 30.8],
  SA: [23.89, 45.08],  PK: [30.37, 69.35],   BD: [23.68, 90.36],
  PH: [12.88, 121.77], VN: [14.06, 108.28],  HK: [22.32, 114.17],
  TW: [23.7, 121.0],   IL: [31.05, 34.85],   GH: [7.95, -1.02],
  TZ: [-6.37, 34.89],  ET: [9.15, 40.49],    ZW: [-19.02, 29.15],
};

const CITY_COORDS: Record<string, [number, number]> = {
  'London': [51.51, -0.13],      'Manchester': [53.48, -2.24],
  'Birmingham': [52.48, -1.9],   'Edinburgh': [55.95, -3.19],
  'Glasgow': [55.86, -4.25],     'Leeds': [53.8, -1.55],
  'Bristol': [51.45, -2.59],     'Liverpool': [53.41, -2.98],
  'Sheffield': [53.38, -1.47],   'Cardiff': [51.48, -3.18],
  'Belfast': [54.6, -5.93],      'Oxford': [51.75, -1.26],
  'Cambridge': [52.21, 0.12],    'Brighton': [50.83, -0.14],
  'New York': [40.71, -74.01],   'Los Angeles': [34.05, -118.24],
  'Chicago': [41.85, -87.65],    'Houston': [29.76, -95.37],
  'Phoenix': [33.45, -112.07],   'Philadelphia': [39.95, -75.17],
  'San Antonio': [29.42, -98.5], 'San Diego': [32.72, -117.15],
  'Dallas': [32.78, -96.8],      'San Francisco': [37.78, -122.42],
  'Seattle': [47.61, -122.33],   'Boston': [42.36, -71.06],
  'Denver': [39.74, -104.98],    'Atlanta': [33.75, -84.39],
  'Miami': [25.77, -80.19],      'Portland': [45.52, -122.68],
  'Las Vegas': [36.17, -115.14], 'Austin': [30.27, -97.74],
  'Nashville': [36.17, -86.78],  'Minneapolis': [44.98, -93.27],
  'Sydney': [-33.87, 151.21],    'Melbourne': [-37.81, 144.96],
  'Brisbane': [-27.47, 153.03],  'Perth': [-31.95, 115.86],
  'Adelaide': [-34.93, 138.6],   'Dublin': [53.33, -6.25],
  'Toronto': [43.65, -79.38],    'Vancouver': [49.25, -123.12],
  'Montreal': [45.51, -73.56],   'Calgary': [51.04, -114.07],
  'Berlin': [52.52, 13.41],      'Munich': [48.14, 11.58],
  'Hamburg': [53.57, 10.02],     'Frankfurt': [50.11, 8.68],
  'Paris': [48.85, 2.35],        'Lyon': [45.75, 4.85],
  'Amsterdam': [52.37, 4.9],     'Stockholm': [59.33, 18.07],
  'Oslo': [59.91, 10.75],        'Copenhagen': [55.68, 12.57],
  'Helsinki': [60.17, 24.94],    'Vienna': [48.21, 16.37],
  'Zurich': [47.38, 8.54],       'Brussels': [50.85, 4.35],
  'Madrid': [40.42, -3.7],       'Barcelona': [41.39, 2.16],
  'Rome': [41.9, 12.5],          'Milan': [45.47, 9.19],
  'Mumbai': [19.08, 72.88],      'Delhi': [28.66, 77.23],
  'Bangalore': [12.97, 77.59],   'Hyderabad': [17.38, 78.49],
  'Chennai': [13.08, 80.27],     'Kolkata': [22.57, 88.36],
  'Tokyo': [35.69, 139.69],      'Osaka': [34.69, 135.5],
  'Seoul': [37.57, 126.98],      'Beijing': [39.91, 116.39],
  'Shanghai': [31.22, 121.46],   'Shenzhen': [22.54, 114.06],
  'Singapore': [1.29, 103.85],   'Kuala Lumpur': [3.14, 101.69],
  'Jakarta': [-6.21, 106.85],    'Bangkok': [13.75, 100.52],
  'Dubai': [25.2, 55.27],        'Riyadh': [24.69, 46.72],
  'Cairo': [30.04, 31.24],       'Johannesburg': [-26.2, 28.04],
  'Cape Town': [-33.93, 18.42],  'Lagos': [6.45, 3.39],
  'Nairobi': [-1.29, 36.82],     'São Paulo': [-23.55, -46.63],
  'Buenos Aires': [-34.6, -58.38],'Mexico City': [19.43, -99.13],
  'Warsaw': [52.23, 21.01],      'Prague': [50.08, 14.47],
  'Lisbon': [38.72, -9.14],      'Athens': [37.98, 23.73],
  'Moscow': [55.75, 37.62],      'Istanbul': [41.01, 28.97],
  'Tel Aviv': [32.09, 34.79],    'Hong Kong': [22.32, 114.17],
  'Auckland': [-36.86, 174.77],
};

function geoCoords(city: string | null, country: string | null): [number, number] | null {
  if (city && CITY_COORDS[city]) return CITY_COORDS[city];
  if (country && COUNTRY_COORDS[country]) return COUNTRY_COORDS[country];
  return null;
}

// ── Time bucketing ─────────────────────────────────────────────────────────────

function rangeConfig(range: LiveRange): { startMs: number; bucketMs: number; bucketCount: number; bucketType: BucketType } {
  const now = Date.now();
  switch (range) {
    case '1h':  return { startMs: now - 60 * 60_000,        bucketMs: 5 * 60_000,        bucketCount: 12, bucketType: 'time' };
    case '6h':  return { startMs: now - 6 * 3600_000,       bucketMs: 30 * 60_000,       bucketCount: 12, bucketType: 'time' };
    case '24h': return { startMs: now - 24 * 3600_000,      bucketMs: 60 * 60_000,       bucketCount: 24, bucketType: 'time' };
    case '7d':  return { startMs: now - 7 * 86400_000,      bucketMs: 86400_000,         bucketCount: 7,  bucketType: 'date' };
    case '30d': return { startMs: now - 30 * 86400_000,     bucketMs: 86400_000,         bucketCount: 30, bucketType: 'date' };
    case '90d': return { startMs: now - 90 * 86400_000,     bucketMs: 7 * 86400_000,     bucketCount: 13, bucketType: 'week' };
    case '6m':  return { startMs: now - 183 * 86400_000,    bucketMs: 7 * 86400_000,     bucketCount: 26, bucketType: 'week' };
    case '12m': return { startMs: now - 365 * 86400_000,    bucketMs: 30.5 * 86400_000,  bucketCount: 12, bucketType: 'month' };
  }
}

function bucketLabel(ts: number, type: BucketType): string {
  const d = new Date(ts);
  if (type === 'time')  return d.toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit' });
  if (type === 'date')  return d.toLocaleDateString('en-GB',  { day: 'numeric', month: 'short' });
  if (type === 'week')  return d.toLocaleDateString('en-GB',  { day: 'numeric', month: 'short' });
  if (type === 'month') return d.toLocaleDateString('en-GB',  { month: 'short', year: '2-digit' });
  return d.toISOString().slice(0, 10);
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawRange = req.nextUrl.searchParams.get('range') ?? '30d';
  const VALID: LiveRange[] = ['1h', '6h', '24h', '7d', '30d', '90d', '6m', '12m'];
  if (!VALID.includes(rawRange as LiveRange)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
  }
  const range = rawRange as LiveRange;

  const now = new Date();
  const cfg = rangeConfig(range);
  const startISO     = new Date(cfg.startMs).toISOString();
  const fiveMinAgo   = new Date(now.getTime() - 5 * 60_000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();

  const client = db();

  const [
    liveCountRes,
    sessionsRes,
    pvRes,
    convRes,
    heatmapRes,
    recentRes,
    liveLocRes,
  ] = await Promise.all([
    // Live visitors (last 5 min)
    client.from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen_at', fiveMinAgo),

    // All sessions in range (for series, bounce, duration, countries, channels)
    client.from('visitor_sessions')
      .select('created_at, last_seen_at, page_view_count, country, city, converted, utm_source, utm_medium')
      .gte('created_at', startISO)
      .order('created_at', { ascending: true })
      .limit(20_000),

    // Page views in range (for series + top pages)
    client.from('page_views')
      .select('created_at, path, country, city')
      .gte('created_at', startISO)
      .order('created_at', { ascending: true })
      .limit(50_000),

    // Conversions in range
    client.from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startISO)
      .eq('converted', true),

    // 7-day hourly heatmap
    client.from('visitor_sessions')
      .select('created_at')
      .gte('created_at', sevenDaysAgo)
      .limit(10_000),

    // Recent page events (live feed)
    client.from('page_views')
      .select('path, city, country, created_at')
      .order('created_at', { ascending: false })
      .limit(25),

    // Active location pins (last 5 min)
    client.from('visitor_sessions')
      .select('country, city, last_seen_at')
      .gte('last_seen_at', fiveMinAgo)
      .not('country', 'is', null),
  ]);

  const sessions = sessionsRes.data ?? [];
  const pvRows   = pvRes.data   ?? [];

  // ── Time series buckets ────────────────────────────────────────────────────

  const sBuckets  = new Array<number>(cfg.bucketCount).fill(0);
  const pvBuckets = new Array<number>(cfg.bucketCount).fill(0);

  for (const s of sessions) {
    const idx = Math.floor((new Date(s.created_at).getTime() - cfg.startMs) / cfg.bucketMs);
    if (idx >= 0 && idx < cfg.bucketCount) sBuckets[idx]++;
  }
  for (const pv of pvRows) {
    const idx = Math.floor((new Date(pv.created_at).getTime() - cfg.startMs) / cfg.bucketMs);
    if (idx >= 0 && idx < cfg.bucketCount) pvBuckets[idx]++;
  }

  const time_series = sBuckets.map((v, i) => ({
    label:     bucketLabel(cfg.startMs + i * cfg.bucketMs, cfg.bucketType),
    visitors:  v,
    pageviews: pvBuckets[i],
  }));

  // ── Engagement metrics ────────────────────────────────────────────────────

  const bounced = sessions.filter(s => (s.page_view_count ?? 1) <= 1).length;
  const bounce_rate = sessions.length > 0 ? Math.round((bounced / sessions.length) * 1000) / 10 : 0;

  const durations = sessions
    .map(s => new Date(s.last_seen_at).getTime() - new Date(s.created_at).getTime())
    .filter(d => d > 1000 && d < 3_600_000);
  const avg_duration_seconds = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
    : 0;

  // ── Country breakdown ─────────────────────────────────────────────────────

  const countryCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.country) countryCounts[s.country] = (countryCounts[s.country] ?? 0) + 1;
  }
  const top_countries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([country, count]) => {
      const c = COUNTRY_COORDS[country];
      return { country, count, lat: c?.[0] ?? 0, lng: c?.[1] ?? 0 };
    });

  // ── Channel attribution ───────────────────────────────────────────────────

  const channelCounts: Record<string, number> = {};
  for (const s of sessions) {
    const src  = s.utm_source ?? 'direct';
    const med  = s.utm_medium;
    const label = med ? `${src} / ${med}` : src;
    channelCounts[label] = (channelCounts[label] ?? 0) + 1;
  }
  const top_channels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([channel, count]) => ({ channel, count }));

  // ── Top pages ─────────────────────────────────────────────────────────────

  const pageCounts: Record<string, number> = {};
  for (const pv of pvRows) {
    const p = pv.path ?? '/';
    pageCounts[p] = (pageCounts[p] ?? 0) + 1;
  }
  const top_pages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }));

  // ── Hourly heatmap  [0=Sun…6=Sat][0…23] ──────────────────────────────────

  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const row of (heatmapRes.data ?? [])) {
    const d = new Date(row.created_at);
    heatmap[d.getDay()][d.getHours()]++;
  }

  // ── Visitor locations for globe ───────────────────────────────────────────

  type LocEntry = { lat: number; lng: number; live: boolean; country: string; city?: string; count: number };
  const locMap = new Map<string, LocEntry>();

  for (const s of sessions) {
    const coords = geoCoords(s.city, s.country);
    if (!coords) continue;
    const key = `${Math.round(coords[0] * 2) / 2}:${Math.round(coords[1] * 2) / 2}`;
    const e = locMap.get(key);
    if (e) { e.count++; }
    else locMap.set(key, { lat: coords[0], lng: coords[1], live: false, country: s.country ?? '', city: s.city ?? undefined, count: 1 });
  }
  for (const s of (liveLocRes.data ?? [])) {
    const coords = geoCoords(s.city, s.country);
    if (!coords) continue;
    const key = `${Math.round(coords[0] * 2) / 2}:${Math.round(coords[1] * 2) / 2}`;
    const e = locMap.get(key);
    if (e) { e.live = true; }
    else locMap.set(key, { lat: coords[0], lng: coords[1], live: true, country: s.country ?? '', city: s.city ?? undefined, count: 1 });
  }

  const visitor_locations = Array.from(locMap.values()).slice(0, 300);

  // ── Recent events feed ────────────────────────────────────────────────────

  const recent_events = (recentRes.data ?? []).map(e => ({
    path:    e.path,
    city:    e.city    ?? undefined,
    country: e.country ?? undefined,
    ts:      e.created_at,
  }));

  // ── Response ──────────────────────────────────────────────────────────────

  return NextResponse.json({
    live_visitors:       liveCountRes.count ?? 0,
    range_visitors:      sessions.length,
    range_pageviews:     pvRows.length,
    range_conversions:   convRes.count ?? 0,
    conversion_rate:     sessions.length > 0
      ? Math.round(((convRes.count ?? 0) / sessions.length) * 1000) / 10
      : 0,
    bounce_rate,
    avg_duration_seconds,
    time_series,
    bucket_type:         cfg.bucketType,
    top_countries,
    top_channels,
    top_pages,
    visitor_locations,
    heatmap,
    recent_events,
    as_of:               now.toISOString(),
    range,
  });
}
