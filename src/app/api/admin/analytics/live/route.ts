import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = db();
  const now = new Date();
  const fiveMinAgo  = new Date(now.getTime() - 5  * 60 * 1000).toISOString();
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const thirtyDays  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    liveRes,
    todaySessionsRes,
    todayPVRes,
    todayConversionsRes,
    countryRes,
    channelRes,
    topPagesRes,
    thirtyDayRes,
  ] = await Promise.all([
    // Live: sessions active in last 5 min
    client.from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen_at', fiveMinAgo),

    // Today: unique sessions
    client.from('visitor_sessions')
      .select('id, converted', { count: 'exact' })
      .gte('created_at', todayStart),

    // Today: page views
    client.from('page_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart),

    // Today: conversions
    client.from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .eq('converted', true),

    // Country breakdown (last 30 days)
    client.from('visitor_sessions')
      .select('country')
      .gte('created_at', thirtyDays)
      .not('country', 'is', null),

    // Channel attribution (last 30 days)
    client.from('visitor_sessions')
      .select('utm_source, utm_medium')
      .gte('created_at', thirtyDays),

    // Top pages today
    client.from('page_views')
      .select('path')
      .gte('created_at', todayStart),

    // 30-day daily visitors
    client.from('visitor_sessions')
      .select('created_at')
      .gte('created_at', thirtyDays)
      .order('created_at', { ascending: true }),
  ]);

  // Aggregate country breakdown
  const countryCounts: Record<string, number> = {};
  for (const row of (countryRes.data ?? [])) {
    const c = row.country ?? 'Unknown';
    countryCounts[c] = (countryCounts[c] ?? 0) + 1;
  }
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));

  // Aggregate channel attribution
  const channelCounts: Record<string, number> = {};
  for (const row of (channelRes.data ?? [])) {
    const source = row.utm_source ?? 'direct';
    const medium = row.utm_medium;
    const label  = medium ? `${source} / ${medium}` : source;
    channelCounts[label] = (channelCounts[label] ?? 0) + 1;
  }
  const topChannels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([channel, count]) => ({ channel, count }));

  // Top pages today
  const pageCounts: Record<string, number> = {};
  for (const row of (topPagesRes.data ?? [])) {
    const p = row.path ?? '/';
    pageCounts[p] = (pageCounts[p] ?? 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }));

  // 30-day daily visitors aggregated by date
  const dailyCounts: Record<string, number> = {};
  for (const row of (thirtyDayRes.data ?? [])) {
    const date = row.created_at.slice(0, 10);
    dailyCounts[date] = (dailyCounts[date] ?? 0) + 1;
  }
  const dailySeries = Object.entries(dailyCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, visitors]) => ({ date, visitors }));

  // Conversion rate today
  const todaySessions = todaySessionsRes.count ?? 0;
  const todayConverted = todayConversionsRes.count ?? 0;

  return NextResponse.json({
    live_visitors:       liveRes.count ?? 0,
    today_visitors:      todaySessions,
    today_page_views:    todayPVRes.count ?? 0,
    today_conversions:   todayConverted,
    conversion_rate_pct: todaySessions > 0
      ? Math.round((todayConverted / todaySessions) * 1000) / 10
      : 0,
    top_countries: topCountries,
    top_channels:  topChannels,
    top_pages:     topPages,
    daily_series:  dailySeries,
    as_of:         now.toISOString(),
  });
}
