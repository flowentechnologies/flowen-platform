#!/usr/bin/env node
// One-off bulk upload of brandkit/ deliverables into the existing Supabase
// `assets` storage bucket (public) + `asset_files` tracking table, under the
// `brand` folder — reusing the exact schema/convention already established
// by src/app/api/admin/assets/route.ts.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET = 'assets';
const ROOT = join(process.cwd(), 'brandkit');

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};
const INCLUDE_EXT = new Set(Object.keys(MIME));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (INCLUDE_EXT.has(extname(entry).toLowerCase())) out.push(full);
  }
  return out;
}

function tagsFor(relPath) {
  const tags = ['brand', 'flowen'];
  if (relPath.startsWith('icons/')) tags.push('icon', 'app-icon');
  if (relPath.startsWith('logo/')) tags.push('logo', 'waveform-mark');
  if (relPath.startsWith('logo-wordmark/')) tags.push('logo', 'wordmark');
  if (relPath.includes('social/grid/')) tags.push('social', 'instagram', 'flowen-acronym');
  if (relPath.includes('social/grid-slt/')) tags.push('social', 'instagram', 'slt-acronym');
  if (relPath.includes('social/grid-therapy/')) tags.push('social', 'instagram', 'therapy-series');
  if (relPath.includes('social/grid-stutter/')) tags.push('social', 'instagram', 'stutter-series');
  if (relPath.includes('social/grid-courage/')) tags.push('social', 'instagram', 'courage-series');
  if (relPath.startsWith('social/') && !relPath.includes('/grid')) tags.push('social', 'marketing-banner');
  if (relPath.includes('flowen-story-')) tags.push('story-format');
  if (relPath.includes('flowen-grid-')) tags.push('grid-format');
  if (relPath.endsWith('captions.txt') || relPath === 'social/caption.txt') tags.push('caption', 'copy');
  return tags;
}

function nameFor(relPath) {
  return relPath
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[/_-]+/g, ' ')
    .trim();
}

async function main() {
  const files = walk(ROOT).sort();
  console.log(`Found ${files.length} files to upload.\n`);

  let ok = 0, failed = 0;
  const failures = [];

  for (const absPath of files) {
    const relPath = relative(ROOT, absPath).split('\\').join('/'); // posix-ify on any platform
    const ext = extname(absPath).toLowerCase();
    const mime = MIME[ext] ?? 'application/octet-stream';
    const storagePath = `brand/${relPath}`;
    const bytes = readFileSync(absPath);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: mime, upsert: true });

    if (uploadError) {
      failed++;
      failures.push(`${relPath}: ${uploadError.message}`);
      continue;
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    const { error: dbError } = await supabase.from('asset_files').upsert({
      name: nameFor(relPath),
      description: `Flowen brand asset — ${relPath}`,
      folder: 'brand',
      filename: basename(absPath),
      storage_path: storagePath,
      public_url: publicUrl,
      file_size: bytes.length,
      mime_type: mime,
      tags: tagsFor(relPath),
    }, { onConflict: 'storage_path' });

    if (dbError) {
      failed++;
      failures.push(`${relPath} (db): ${dbError.message}`);
      continue;
    }

    ok++;
    process.stdout.write(`✔ ${relPath}\n`);
  }

  console.log(`\nDone. ${ok} uploaded, ${failed} failed.`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main();
