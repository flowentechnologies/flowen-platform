#!/usr/bin/env node
// Generates a Data Room PDF for every policy already written verbatim in
// /admin/policies (src/app/admin/policies/page.tsx). The content is
// extracted directly from that source file at runtime — not retyped here —
// so there is zero risk of transcription drift from the authoritative
// version admins actually see in the app.
//
// This fills the 'technical' category (previously empty in the Data Room)
// via the Business Continuity/DR and Acceptable Use policies, and adds
// real depth to legal, clinical, regulatory, and financial with the
// remaining policies and the two investor materials.
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

// ── Extract the real POLICIES array from the admin page source ──────────────
const SOURCE_PATH = new URL('../src/app/admin/policies/page.tsx', import.meta.url);
const source = readFileSync(SOURCE_PATH, 'utf-8');

const EFFECTIVE = source.match(/const EFFECTIVE = '([^']+)'/)[1];
const COMPANY = source.match(/const COMPANY = '([^']+)'/)[1];
const EMAIL = source.match(/const EMAIL = '([^']+)'/)[1];

const arrayStart = source.indexOf('const POLICIES: PolicyDoc[] = [');
const literalStart = source.indexOf('[', arrayStart);
const arrayEnd = source.indexOf('\n];', literalStart) + 2; // include the closing bracket
const arrayLiteral = source.slice(literalStart, arrayEnd);

// Safe-ish eval: the extracted text is a plain JS array/object literal using
// only template literals that reference EFFECTIVE/COMPANY/EMAIL — no JSX,
// no imports, nothing executable beyond that.
const POLICIES = new Function('EFFECTIVE', 'COMPANY', 'EMAIL', `return ${arrayLiteral};`)(EFFECTIVE, COMPANY, EMAIL);

console.log(`Extracted ${POLICIES.length} policies from ${SOURCE_PATH.pathname}`);

// tag alone doesn't distinguish CLINICAL SAFETY sub-types finely enough for
// the Data Room's 6 categories, so a few IDs are mapped individually.
const TAG_CATEGORY = {
  'DATA PROTECTION': 'legal',
  GOVERNANCE: 'legal',
  OPERATIONS: 'technical',
  INVESTOR: 'financial',
};
const ID_CATEGORY_OVERRIDE = {
  'POL-006': 'clinical', // Clinical Safety Management System
  'POL-011': 'clinical', // Post-Market Surveillance Plan
  'POL-012': 'clinical', // Clinical Safety Case
  'POL-007': 'regulatory', // Equality Impact Assessment (DTAC)
  'POL-008': 'regulatory', // Sustainability Statement (DTAC)
  'POL-009': 'regulatory', // AI Governance & Transparency (DTAC)
  'POL-010': 'regulatory', // MHRA Intended Purpose & SaMD Classification
};

function categoryFor(policy) {
  return ID_CATEGORY_OVERRIDE[policy.id] ?? TAG_CATEGORY[policy.tag] ?? 'corporate';
}

// pdfkit's Standard-14 Helvetica uses WinAnsiEncoding, which has no glyph
// for U+2501 (heavy box-drawing horizontal) — the divider character used
// throughout these policies. Substituted with a plain hyphen rule for
// rendering only; the stored policy text in the app is untouched.
function forPdf(text) {
  return text.replace(/━+/g, (m) => '-'.repeat(m.length));
}

function buildPolicyPDF(policy) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#8B5CF6').text(`FLOWEN — CONFIDENTIAL — ${policy.tag}`);
    doc.moveDown(0.3);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0C0E1A').text(policy.title);
    doc.fontSize(8.5).font('Helvetica').fillColor('#888').text(`${policy.id} · ${policy.version} · Effective ${EFFECTIVE} · Owner: ${EMAIL}`);
    doc.moveDown(1);

    doc.fontSize(8.5).font('Helvetica').fillColor('#1a1a1a').text(forPdf(policy.content), { lineGap: 1.5 });

    doc.end();
  });
}

async function publish(policy, pdfBuffer) {
  const category = categoryFor(policy);
  const safeName = policy.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  const storagePath = `${category}/${safeName}-${Date.now()}.pdf`;

  const { data: existing } = await supabase.from('data_room_documents').select('id, storage_path').eq('title', policy.title);
  if (existing?.length) {
    await supabase.storage.from(BUCKET).remove(existing.map((d) => d.storage_path));
    await supabase.from('data_room_documents').delete().in('id', existing.map((d) => d.id));
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (uploadError) throw new Error(`upload ${policy.title}: ${uploadError.message}`);

  const { error: dbError } = await supabase.from('data_room_documents').insert({
    title: policy.title,
    description: policy.summary,
    category,
    filename: `${safeName}.pdf`,
    storage_path: storagePath,
    file_size: pdfBuffer.length,
    mime_type: 'application/pdf',
    version: policy.version,
  });
  if (dbError) throw new Error(`insert ${policy.title}: ${dbError.message}`);

  console.log(`✓ ${policy.id} ${policy.title} (${category}) — ${(pdfBuffer.length / 1024).toFixed(0)} KB`);
}

async function main() {
  for (const policy of POLICIES) {
    const pdf = await buildPolicyPDF(policy);
    await publish(policy, pdf);
  }
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
