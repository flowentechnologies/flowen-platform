import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/assets/screenshots');
mkdirSync(OUT, { recursive: true });

const MOCKUPS = [
  { name: 'onboarding',         file: '/tmp/flowen-mockups/onboarding.html' },
  { name: 'dashboard-home',     file: '/tmp/flowen-mockups/dashboard-home.html' },
  { name: 'dashboard-practice', file: '/tmp/flowen-mockups/practice.html' },
  { name: 'dashboard-analytics',file: '/tmp/flowen-mockups/analytics.html' },
  { name: 'clinician',          file: '/tmp/flowen-mockups/clinician.html' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'dark',
  deviceScaleFactor: 2,
});

for (const m of MOCKUPS) {
  const page = await ctx.newPage();
  const url = pathToFileURL(m.file).href;
  console.log(`📸 ${m.name}`);
  await page.goto(url, { waitUntil: 'networkidle' });
  // wait for Tailwind CDN to apply
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${m.name}.jpg`), type: 'jpeg', quality: 88 });
  console.log(`   ✓ ${m.name}.jpg`);
  await page.close();
}

await browser.close();
console.log('\nDone.');
