// screenshots the live production site for all key flows
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/assets/screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = 'https://flowen.digital';
const W = 1280, H = 800;

const PAGES = [
  // Marketing
  { name: 'landing',          url: `${BASE}/`,                  full: false },
  { name: 'pricing',          url: `${BASE}/pricing`,           full: false },
  { name: 'waitlist',         url: `${BASE}/waitlist`,          full: false },
  // Auth flow
  { name: 'auth-signup',      url: `${BASE}/auth/signup`,       full: false },
  { name: 'auth-login',       url: `${BASE}/auth/login`,        full: false },
  // Onboarding (static render — no auth needed)
  { name: 'onboarding',       url: `${BASE}/onboarding`,        full: false },
  // Dashboard — protected, but renders loading skeleton
  { name: 'dashboard-home',   url: `${BASE}/dashboard`,         full: false },
  { name: 'dashboard-practice', url: `${BASE}/dashboard/practice`, full: false },
  { name: 'dashboard-analytics', url: `${BASE}/dashboard/analytics`, full: false },
  { name: 'dashboard-history', url: `${BASE}/dashboard/history`, full: false },
  { name: 'dashboard-settings', url: `${BASE}/dashboard/settings`, full: false },
  { name: 'dashboard-billing', url: `${BASE}/dashboard/billing`, full: false },
  { name: 'clinician',        url: `${BASE}/dashboard/clinician`, full: false },
  // Micro exercise
  { name: 'practice-micro',   url: `${BASE}/dashboard/practice/micro`, full: false },
  // Viseme reference
  { name: 'viseme-reference', url: `${BASE}/viseme`,            full: false },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});

for (const page of PAGES) {
  const p = await context.newPage();
  console.log(`📸 ${page.name} → ${page.url}`);
  try {
    await p.goto(page.url, { waitUntil: 'networkidle', timeout: 15000 });
    await p.waitForTimeout(800);
    await p.screenshot({
      path: join(OUT, `${page.name}.jpg`),
      type: 'jpeg',
      quality: 85,
      fullPage: page.full,
    });
    console.log(`   ✓ saved ${page.name}.jpg`);
  } catch (e) {
    console.warn(`   ✗ failed: ${e.message}`);
  } finally {
    await p.close();
  }
}

await browser.close();
console.log('\nDone — screenshots in public/assets/screenshots/');
