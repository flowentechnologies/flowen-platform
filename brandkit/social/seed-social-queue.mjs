#!/usr/bin/env node
// Seeds social_publish_queue from the 37-post Signal Calendar:
//   - Instagram: the exact existing caption + 5 hashtags, unchanged.
//   - Facebook: same caption plus a CTA line, but trimmed to the top 2
//     hashtags (brand + top category) — FB rewards longer text and is far
//     less hashtag-heavy than Instagram; this is the actual fix for
//     "Instagram is the same posts as Facebook."
//   - LinkedIn: a curated 12-post subset (Launch + the 6 product-feature
//     posts + one flagship per series) with genuinely rewritten,
//     professional/clinical-evidence copy — letter-by-letter acronym
//     breakdowns don't suit LinkedIn's audience, so the full 37 were not
//     mechanically ported. Scheduled ~3x/week, weekday mornings only.
//     Status starts at 'manual_pending': LinkedIn Company Page
//     auto-posting requires Marketing Developer Platform approval
//     (enterprise-gated), so these are posted by hand from /admin/social.
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

// signal-calendar-posts.json is the exact POSTS array extracted from the
// published Signal Calendar artifact (5-hashtag version) — kept in the repo
// so this script is reproducible without depending on scratch files.
const posts = JSON.parse(readFileSync(new URL('./signal-calendar-posts.json', import.meta.url), 'utf-8'));

// day_num -> curated LinkedIn post override (caption, hashtags, scheduled_at)
const LINKEDIN_OVERRIDES = {
  1: { // Launch
    caption: "FLOWEN: Fluency & Language Optimization With Empathic Neurofeedback.\n\nWe've built a sub-80ms real-time acoustic biofeedback platform purpose-built for stuttering therapy — designed to extend the clinical reach of Speech & Language Therapists, not replace them.\n\nFlowen operates within NHS Digital's DCB0129 Clinical Safety Standard and is structured for NHS, Access to Work, and DSA funding pathways.\n\nEvery word gets there.",
    hashtags: '#DigitalHealth #SpeechTherapy #Neurofeedback',
    scheduled_at: '2026-09-03T09:00:00Z',
  },
  32: { // Feature: PWS dashboard
    caption: "Product update: a single dashboard for people who stutter to track practice, guided stages, session history, and fluency analytics — all from the moment they sign in. Built for daily engagement, not just clinical check-ins.",
    hashtags: '#ProductUpdate #DigitalHealth #SpeechTech',
    scheduled_at: '2026-09-04T09:00:00Z',
  },
  33: { // Feature: PWS practice
    caption: "Guided practice, structured. Each session builds on the last, removing the guesswork of “what should I work on today.”",
    hashtags: '#SpeechTherapy #DigitalHealth',
    scheduled_at: '2026-09-07T09:00:00Z',
  },
  34: { // Feature: PWS history
    caption: "Every practice session logged automatically — stage, duration, and detail — giving both the user and their SLT a complete, auditable record of engagement.",
    hashtags: '#ClinicalData #DigitalHealth',
    scheduled_at: '2026-09-08T09:00:00Z',
  },
  35: { // Feature: PWS analytics
    caption: "Fluency progress, visualised. Session-over-session trend data generated automatically, with zero manual logging required from the user or their therapist.",
    hashtags: '#DataVisualisation #DigitalHealth #SpeechTherapy',
    scheduled_at: '2026-09-09T09:00:00Z',
  },
  36: { // Feature: SLT caseload
    caption: "For Speech & Language Therapists managing a full caseload: session counts, practice time, and fluency trend for every patient, on one screen. Built to extend clinical oversight between appointments, not add to admin burden.",
    hashtags: '#SLT #ClinicalPortal #DigitalHealth',
    scheduled_at: '2026-09-10T09:00:00Z',
  },
  37: { // Feature: SLT patient detail
    caption: "Full session history and trend data for every patient, ready before you walk into the room. Remote monitoring that respects clinical time.",
    hashtags: '#SLT #ClinicalCare #DigitalHealth',
    scheduled_at: '2026-09-11T09:00:00Z',
  },
  4: { // FLOWEN — O — Optimization (sub-80ms)
    caption: "Sub-80ms feedback latency — fast enough to support a speaker mid-sentence, not just after the fact. This is the technical foundation Flowen is built on.",
    hashtags: '#Neurofeedback #SpeechTech #DigitalHealth',
    scheduled_at: '2026-09-14T09:00:00Z',
  },
  10: { // SLT — T — Therapist (remote monitoring)
    caption: "On Flowen's Funded Access tier, an SLT can review session data remotely, adjust the programme, and track progress — without requiring an in-person appointment for every check-in.",
    hashtags: '#SLT #RemoteMonitoring #DigitalHealth',
    scheduled_at: '2026-09-15T09:00:00Z',
  },
  15: { // THERAPY — A — Adaptive
    caption: "Programmes that adapt as the user progresses, reviewed remotely by their SLT — not a static, one-size-fits-all protocol.",
    hashtags: '#SpeechTherapy #ClinicalCare',
    scheduled_at: '2026-09-16T09:00:00Z',
  },
  18: { // STUTTER — S — Support (70M)
    caption: "70 million people worldwide stutter. Flowen is built to meet them with real-time, evidence-based support — not just awareness.",
    hashtags: '#Stuttering #DigitalHealth #Neurofeedback',
    scheduled_at: '2026-09-17T09:00:00Z',
  },
  26: { // COURAGE — O — Ownership
    caption: "Every user's programme, at their own pace — adjusted remotely by their SLT rather than dictated by a fixed course schedule.",
    hashtags: '#SpeechTherapy #PatientCentred',
    scheduled_at: '2026-09-18T09:00:00Z',
  },
};

function firstAssetPath(asset) {
  return asset.split(' + ')[0].trim();
}

function fbHashtags(igHashtags) {
  // Keep #Flowen (brand) plus the first non-Flowen tag (top category) — FB
  // rewards long-form text over hashtag density, unlike Instagram.
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

async function main() {
  // Guard against accidental double-seeding — this is a one-time population
  // script, not meant to be rerun routinely (there's no unique constraint on
  // (day_num, platform) to upsert against, and blindly re-inserting would
  // duplicate every row).
  const { count } = await supabase
    .from('social_publish_queue')
    .select('*', { count: 'exact', head: true });
  if (count && count > 0) {
    console.error(`social_publish_queue already has ${count} rows — refusing to reseed. Truncate the table first if you really want to reset it.`);
    process.exit(1);
  }

  const rows = [];

  for (const p of posts) {
    const assetPath = firstAssetPath(p.asset);
    const assetUrl = await assetUrlFor(assetPath);
    const scheduledAt = new Date(`${p.date}T${p.time}:00Z`).toISOString();

    // Instagram — unchanged
    rows.push({
      series: p.series,
      day_num: p.day_num,
      platform: 'instagram',
      caption: p.caption,
      hashtags: p.hashtags,
      asset_path: assetPath,
      asset_public_url: assetUrl,
      scheduled_at: scheduledAt,
      status: 'pending',
    });

    // Facebook — same caption + CTA, trimmed hashtags
    rows.push({
      series: p.series,
      day_num: p.day_num,
      platform: 'facebook',
      caption: `${p.caption}\n\nLearn more: flowen.digital`,
      hashtags: fbHashtags(p.hashtags),
      asset_path: assetPath,
      asset_public_url: assetUrl,
      scheduled_at: scheduledAt,
      status: 'pending',
    });

    // LinkedIn — curated subset only
    const li = LINKEDIN_OVERRIDES[p.day_num];
    if (li) {
      rows.push({
        series: p.series,
        day_num: p.day_num,
        platform: 'linkedin',
        caption: li.caption,
        hashtags: li.hashtags,
        asset_path: assetPath,
        asset_public_url: assetUrl, // informational only — LinkedIn post is manual
        scheduled_at: li.scheduled_at,
        status: 'manual_pending',
      });
    }
  }

  console.log(`Inserting ${rows.length} rows (${rows.filter(r => r.platform === 'instagram').length} IG, ${rows.filter(r => r.platform === 'facebook').length} FB, ${rows.filter(r => r.platform === 'linkedin').length} LinkedIn)...`);

  const { error } = await supabase.from('social_publish_queue').insert(rows);
  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }
  console.log('Done.');
}

main();
