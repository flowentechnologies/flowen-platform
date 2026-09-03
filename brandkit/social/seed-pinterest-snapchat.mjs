#!/usr/bin/env node
// Seeds social_publish_queue with the same 37-post Signal Calendar for two
// new platforms:
//   - Pinterest: full auto-publish once connected (see
//     /api/admin/social/pinterest/connect). Same caption as Instagram,
//     trimmed to a 2-hashtag description like Facebook — Pinterest search
//     runs on board/description text and the pin title, not hashtag
//     density.
//   - Snapchat: manual, like LinkedIn — Snap's organic Public Profile API
//     is allowlist-only (Snap must approve the app's client ID via a
//     business contact), so there's no self-serve auto-publish path.
//     Reuses the Instagram caption/hashtags as-is — Snapchat's casual tone
//     matches Instagram far more than it matches LinkedIn's, so no rewrite
//     was needed here (unlike the LinkedIn curation).
//
// Unlike the original seed (which anchored to the campaign's real launch
// date), these start "today" on a fresh 3-slot/day cadence (09:00/14:00/
// 19:00 UTC) since neither platform has posted anything yet — there's no
// backlog or overlap with what's already live to account for.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const posts = JSON.parse(readFileSync(new URL('./signal-calendar-posts.json', import.meta.url), 'utf-8'));

const SLOT_HOURS = [9, 14, 19]; // UTC, matches the existing IG/FB cadence

function firstAssetPath(asset) {
  return asset.split(' + ')[0].trim();
}

function trimmedHashtags(igHashtags) {
  // Brand tag + top category tag — same trim Facebook uses; Pinterest
  // discovery runs on the description text, not hashtag count.
  const tags = igHashtags.split(/\s+/).filter(Boolean);
  const brand = tags.find(t => t.toLowerCase() === '#flowen');
  const rest = tags.filter(t => t.toLowerCase() !== '#flowen');
  return [brand, rest[0]].filter(Boolean).join(' ');
}

async function assetUrlFor(relPath) {
  const storagePath = `brand/${relPath}`;
  const { data, error } = await supabase
    .from('asset_files')
    .select('public_url')
    .eq('storage_path', storagePath)
    .maybeSingle();
  if (error || !data) {
    console.warn(`  ! no asset_files row for ${storagePath}`);
    return null;
  }
  return data.public_url;
}

/** Next slot strictly after `from`, then step forward 3-per-day at 09:00/14:00/19:00 UTC. */
function slotSchedule(from, count) {
  const cursor = new Date(from);
  let hourIdx = SLOT_HOURS.findIndex(h => h > from.getUTCHours());
  if (hourIdx === -1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    hourIdx = 0;
  }
  cursor.setUTCHours(SLOT_HOURS[hourIdx], 0, 0, 0);

  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(cursor));
    hourIdx = (hourIdx + 1) % SLOT_HOURS.length;
    if (hourIdx === 0) cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(SLOT_HOURS[hourIdx], 0, 0, 0);
  }
  return out;
}

async function main() {
  const { count } = await supabase
    .from('social_publish_queue')
    .select('*', { count: 'exact', head: true })
    .in('platform', ['pinterest', 'snapchat']);
  if (count && count > 0) {
    console.error(`Pinterest/Snapchat rows already exist (${count}) — refusing to reseed.`);
    process.exit(1);
  }

  const schedule = slotSchedule(new Date(), posts.length);
  const rows = [];

  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const assetPath = firstAssetPath(p.asset);
    const assetUrl = await assetUrlFor(assetPath);
    const scheduledAt = schedule[i].toISOString();

    rows.push({
      series: p.series,
      day_num: p.day_num,
      platform: 'pinterest',
      caption: p.caption,
      hashtags: trimmedHashtags(p.hashtags),
      asset_path: assetPath,
      asset_public_url: assetUrl,
      scheduled_at: scheduledAt,
      status: 'pending',
    });

    rows.push({
      series: p.series,
      day_num: p.day_num,
      platform: 'snapchat',
      caption: p.caption,
      hashtags: trimmedHashtags(p.hashtags),
      asset_path: assetPath,
      asset_public_url: assetUrl,
      scheduled_at: scheduledAt,
      status: 'manual_pending',
    });
  }

  console.log(`Inserting ${rows.length} rows (${rows.filter(r => r.platform === 'pinterest').length} Pinterest, ${rows.filter(r => r.platform === 'snapchat').length} Snapchat)...`);
  console.log(`First slot: ${schedule[0].toISOString()}`);

  const { error } = await supabase.from('social_publish_queue').insert(rows);
  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }
  console.log('Done.');
}

main();
