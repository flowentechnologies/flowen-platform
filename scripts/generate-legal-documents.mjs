#!/usr/bin/env node
// Generates Data Room PDFs from Flowen's real, already-published public
// legal pages — MASTER_POLICIES (src/app/legal/policies.ts: Privacy
// Policy, Terms of Service, public DCB0129 Clinical Safety Statement,
// Governing Law, Cookie Policy) and the Data Processing Agreement clauses
// (src/app/dpa/page.tsx). These are live on flowen.digital already — this
// just gives the Data Room a durable copy of the exact same text, not new
// content.
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
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
const BUCKET = 'data-room';

function forPdf(text) {
  return text.replace(/━+/g, (m) => '-'.repeat(m.length));
}

function buildTextPDF({ title, tag, subtitle, body }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#8B5CF6').text(`FLOWEN — ${tag}`);
    doc.moveDown(0.3);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0C0E1A').text(title);
    if (subtitle) doc.fontSize(8.5).font('Helvetica').fillColor('#888').text(subtitle);
    doc.moveDown(1);
    doc.fontSize(8.5).font('Helvetica').fillColor('#1a1a1a').text(forPdf(body), { lineGap: 1.5 });
    doc.end();
  });
}

async function publish({ title, category, description, pdfBuffer }) {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  const storagePath = `${category}/${safeName}-${Date.now()}.pdf`;

  const { data: existing } = await supabase.from('data_room_documents').select('id, storage_path').eq('title', title);
  if (existing?.length) {
    await supabase.storage.from(BUCKET).remove(existing.map((d) => d.storage_path));
    await supabase.from('data_room_documents').delete().in('id', existing.map((d) => d.id));
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf', upsert: false,
  });
  if (uploadError) throw new Error(`upload ${title}: ${uploadError.message}`);

  const { error: dbError } = await supabase.from('data_room_documents').insert({
    title, description, category,
    filename: `${safeName}.pdf`,
    storage_path: storagePath,
    file_size: pdfBuffer.length,
    mime_type: 'application/pdf',
    version: 'v1',
  });
  if (dbError) throw new Error(`insert ${title}: ${dbError.message}`);

  console.log(`✓ ${title} (${category}) — ${(pdfBuffer.length / 1024).toFixed(0)} KB`);
}

// ── Extract MASTER_POLICIES from src/app/legal/policies.ts ──────────────────
const policiesPath = new URL('../src/app/legal/policies.ts', import.meta.url);
const policiesSource = readFileSync(policiesPath, 'utf-8');
const policiesLiteralStart = policiesSource.indexOf('{', policiesSource.indexOf('export const MASTER_POLICIES'));
const policiesLiteralEnd = policiesSource.lastIndexOf('};') + 1;
const MASTER_POLICIES = new Function(`return ${policiesSource.slice(policiesLiteralStart, policiesLiteralEnd)};`)();
console.log(`Extracted MASTER_POLICIES (${Object.keys(MASTER_POLICIES).length} keys) from ${policiesPath.pathname}`);

const PUBLIC_LEGAL_DOCS = [
  { key: 'privacyPolicy', title: 'Privacy Policy & UK GDPR Statement', category: 'legal' },
  { key: 'termsOfService', title: 'Terms of Service', category: 'legal' },
  { key: 'clinicalCompliance', title: 'DCB0129 Clinical Safety Statement (Public)', category: 'clinical' },
  { key: 'governingLaw', title: 'Governing Law & Dispute Resolution', category: 'legal' },
  { key: 'cookiePolicy', title: 'Cookie Policy', category: 'legal' },
];

// ── Extract CLAUSES from src/app/dpa/page.tsx ────────────────────────────────
const dpaPath = new URL('../src/app/dpa/page.tsx', import.meta.url);
const dpaSource = readFileSync(dpaPath, 'utf-8');
const dpaLiteralStart = dpaSource.indexOf('[', dpaSource.indexOf('const CLAUSES'));
const dpaLiteralEnd = dpaSource.indexOf('\n];', dpaLiteralStart) + 2;
const CLAUSES = new Function(`return ${dpaSource.slice(dpaLiteralStart, dpaLiteralEnd)};`)();
console.log(`Extracted ${CLAUSES.length} DPA clauses from ${dpaPath.pathname}`);

const dpaBody = CLAUSES.map((c) => `${c.number}. ${c.title.toUpperCase()}\n\n${c.content}`).join('\n\n\n');

async function main() {
  for (const { key, title, category } of PUBLIC_LEGAL_DOCS) {
    const body = MASTER_POLICIES[key];
    if (!body) { console.warn(`! MASTER_POLICIES.${key} not found, skipping`); continue; }
    const pdf = await buildTextPDF({
      title, tag: 'PUBLIC LEGAL DOCUMENT — LIVE ON FLOWEN.DIGITAL', body,
    });
    await publish({ title, category, description: `Live public legal text, published at flowen.digital (${MASTER_POLICIES.effectiveDate}).`, pdfBuffer: pdf });
  }

  const dpaPdf = await buildTextPDF({
    title: 'Data Processing Agreement (UK GDPR Article 28)',
    tag: 'PUBLIC LEGAL DOCUMENT — LIVE ON FLOWEN.DIGITAL',
    subtitle: `${CLAUSES.length} clauses — standard DPA for NHS trusts, ICBs, private clinics, and institutional customers`,
    body: dpaBody,
  });
  await publish({
    title: 'Data Processing Agreement (UK GDPR Article 28)',
    category: 'legal',
    description: 'Standard Data Processing Agreement offered to institutional customers, published at flowen.digital/dpa.',
    pdfBuffer: dpaPdf,
  });

  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
