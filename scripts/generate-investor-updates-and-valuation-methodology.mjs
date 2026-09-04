#!/usr/bin/env node
// Two more real sources into the Data Room:
//   - investor_updates: the actual emails already sent to investors
//     (category: corporate) — honest traction reporting, not polished
//     marketing copy.
//   - valuation_config: the INPUT assumptions behind each valuation
//     method (Berkus component scores, Scorecard weightings, VC-method
//     exit assumptions, DCF projections, NHS-specific assumptions) —
//     distinct from the "Valuation Analysis" document, which only shows
//     the OUTPUT range per method. Sophisticated investors expect to see
//     the assumptions, not just the number.
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
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

const gbp = (pence) => pence == null ? '—' : `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const dateLong = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

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
    doc.fontSize(9).font('Helvetica').fillColor('#1a1a1a').text(body, { lineGap: 2 });
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

async function investorUpdateDocs() {
  const { data: updates } = await supabase.from('investor_updates').select('*').order('sent_at', { ascending: true });
  for (const u of updates ?? []) {
    const title = `Investor Update — ${dateLong(u.sent_at)}`;
    const pdf = await buildTextPDF({
      title,
      tag: 'INVESTOR COMMUNICATION',
      subtitle: `Sent ${dateLong(u.sent_at)} · ${u.recipient_count} recipient${u.recipient_count === 1 ? '' : 's'}`,
      body: u.body,
    });
    await publish({
      title, category: 'corporate',
      description: `Actual investor update email as sent — subject: "${u.subject}".`,
      pdfBuffer: pdf,
    });
  }
}

async function valuationMethodologyDoc() {
  const { data: c } = await supabase.from('valuation_config').select('*').single();
  if (!c) return;

  const body = `This document sets out the assumptions behind each valuation method shown in "Valuation Analysis" — the output range only; this is how each figure was actually derived.

BERKUS METHOD (pre-revenue, qualitative component scoring)
Sound idea (base value): ${gbp(c.berkus_sound_idea)}
Prototype / technology risk reduction: ${gbp(c.berkus_prototype)}
Quality management team: ${gbp(c.berkus_management_team)}
Strategic relationships: ${gbp(c.berkus_strategic_rel)}
Product rollout / sales: ${gbp(c.berkus_product_rollout)}

SCORECARD METHOD
Median pre-money comparable: ${gbp(c.scorecard_median_pence)}
Team factor: ${c.scorecard_team}×
Market size factor: ${c.scorecard_market_size}×
Product/technology factor: ${c.scorecard_product_tech}×
Competitive environment factor: ${c.scorecard_competition}×
Marketing/sales channel factor: ${c.scorecard_marketing}×
Need for additional investment factor: ${c.scorecard_investment_need}×
Other factor: ${c.scorecard_other}×

VC METHOD
Assumed exit valuation: ${gbp(c.vc_exit_valuation_pence)}
Investment amount modelled: ${gbp(c.vc_investment_pence)}
Years to exit: ${c.vc_years_to_exit}
Required investor IRR: ${c.vc_required_irr}%

COMPARABLES METHOD
ARR multiple range applied: ${c.comp_arr_multiple_low}×–${c.comp_arr_multiple_high}×
Baseline comparable valuation: ${gbp(c.comp_baseline_pence)}
Traction premium applied: ${c.comp_traction_premium_pct}%

DISCOUNTED CASH FLOW (illustrative — pre-revenue, projections not historicals)
Discount rate: ${c.dcf_discount_rate}%
Terminal multiple: ${c.dcf_terminal_multiple}×
Year 1 revenue projection: ${gbp(c.dcf_year1_revenue_pence)}
Year 2 revenue projection: ${gbp(c.dcf_year2_revenue_pence)}
Year 3 revenue projection: ${gbp(c.dcf_year3_revenue_pence)}

NHS COMMERCIAL MODEL ASSUMPTIONS (feeds the DCF revenue projections above)
Assumed price per patient: ${gbp(c.nhs_price_per_patient_pence)}
Assumed patients per ICB: ${c.nhs_patients_per_icb.toLocaleString('en-GB')}
Number of ICBs modelled: ${c.nhs_icb_count}
Probability of NHS commissioning success applied: ${c.nhs_probability_pct}%

All figures above are modelling assumptions, not commitments or agreements with any NHS body, investor, or exit counterparty — none of the exit, revenue, or NHS commissioning figures reflect an actual agreement in place. This is standard pre-revenue valuation methodology (Berkus and Scorecard are industry-standard qualitative pre-revenue frameworks); the DCF and NHS commercial figures in particular are illustrative projections and should be read as such by any investor reviewing this document.

Last updated: ${dateLong(c.updated_at)}.`;

  const pdf = await buildTextPDF({
    title: 'Valuation Methodology & Assumptions',
    tag: 'FINANCIAL — VALUATION MODEL',
    subtitle: `The inputs behind each method in "Valuation Analysis" — updated ${dateLong(c.updated_at)}`,
    body,
  });
  await publish({
    title: 'Valuation Methodology & Assumptions',
    category: 'financial',
    description: 'The underlying assumptions and inputs for each valuation method (Berkus, Scorecard, VC Method, Comparables, DCF) — distinct from the output range in "Valuation Analysis".',
    pdfBuffer: pdf,
  });
}

async function main() {
  await investorUpdateDocs();
  await valuationMethodologyDoc();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
