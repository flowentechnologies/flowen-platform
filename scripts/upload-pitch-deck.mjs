#!/usr/bin/env node
// Uploads private/deck.html to the private 'pitch-deck' Supabase Storage
// bucket. Run this whenever the deck content changes — private/ is
// gitignored (this repo is public on GitHub), so editing the local file
// alone does nothing in production; this script is the deploy step.
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

async function main() {
  const html = readFileSync(new URL('../private/deck.html', import.meta.url), 'utf-8');

  const { error } = await supabase.storage
    .from('pitch-deck')
    .upload('deck.html', html, { contentType: 'text/html; charset=utf-8', upsert: true });

  if (error) {
    console.error('Upload failed:', error.message);
    process.exit(1);
  }
  console.log(`Uploaded private/deck.html (${(html.length / 1024).toFixed(1)} KB) to pitch-deck/deck.html`);
}

main();
