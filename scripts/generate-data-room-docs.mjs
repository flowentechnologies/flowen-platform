#!/usr/bin/env node
// Generates real Data Room documents directly from Flowen's own operational
// tables — cap table, valuation model, grant pipeline, IP audit, clinical
// safety hazard log, and compliance framework status. Every figure and
// status in these PDFs is a verbatim read of already-recorded system data
// (the same rows shown in /admin/cap-table, /admin/valuation, /admin/grants,
// /admin/ip, /admin/hazard-log, /admin/compliance) — nothing here is
// invented. 'technical' is deliberately left with no document: there's no
// equivalent real structured table for it yet.
//
// Idempotent per title: reruns replace the previous version of the same
// document rather than duplicating it.
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
const GENERATED_AT = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Formatting helpers ───────────────────────────────────────────────────────

const gbp = (pence) => pence == null ? '—' : `£${(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const date = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';

// ── Generic tabular PDF builder ──────────────────────────────────────────────

function buildTablePDF({ title, subtitle, columns, rows, note }) {
  return new Promise((resolve, reject) => {
    const landscape = columns.length > 4;
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#8B5CF6').text('FLOWEN — CONFIDENTIAL DATA ROOM');
    doc.moveDown(0.4);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0C0E1A').text(title);
    if (subtitle) doc.fontSize(9).font('Helvetica').fillColor('#555').text(subtitle);
    doc.fontSize(8).font('Helvetica').fillColor('#888').text(`Generated ${GENERATED_AT} — data as recorded in the Flowen system`);
    doc.moveDown(1);

    const colWidth = usableWidth / columns.length;
    let y = doc.y;

    function drawHeader() {
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0C0E1A');
      columns.forEach((c, i) => doc.text(c.toUpperCase(), left + i * colWidth, y, { width: colWidth - 6 }));
      y += 14;
      doc.moveTo(left, y).lineTo(left + usableWidth, y).strokeColor('#ccc').lineWidth(0.5).stroke();
      y += 6;
    }
    drawHeader();

    doc.font('Helvetica').fontSize(7.5).fillColor('#222');
    for (const row of rows) {
      const cellTexts = row.map((v) => (v === null || v === undefined || v === '') ? '—' : String(v));
      const rowH = Math.max(...cellTexts.map((t) => doc.heightOfString(t, { width: colWidth - 6 })), 10) + 8;
      if (y + rowH > doc.page.height - doc.page.margins.bottom - 24) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
        doc.font('Helvetica').fontSize(7.5).fillColor('#222');
      }
      cellTexts.forEach((t, i) => doc.text(t, left + i * colWidth, y, { width: colWidth - 6 }));
      y += rowH;
    }

    // Sync pdfkit's own cursor to the row loop's tracked y — the row loop
    // positions every cell explicitly (x, y), which does not advance
    // doc.y/doc.x the way flowing .text() calls do, so without this the
    // note below would render starting from wherever the last drawn cell
    // happened to end (often overlapping the last row).
    doc.x = left;
    doc.y = y;

    if (note) {
      doc.moveDown(1);
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) { doc.addPage(); doc.y = doc.page.margins.top; }
      doc.fontSize(7).font('Helvetica-Oblique').fillColor('#888').text(note, left, doc.y, { width: usableWidth });
    }
    doc.moveDown(1.5);
    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) { doc.addPage(); doc.y = doc.page.margins.top; }
    doc.fontSize(6.5).font('Helvetica').fillColor('#aaa')
      .text('FLOWEN TECHNOLOGIES LTD · CONFIDENTIAL — NOT FOR DISTRIBUTION', left, doc.y, { width: usableWidth, align: 'center' });

    doc.end();
  });
}

// ── Upsert into data_room_documents + storage ────────────────────────────────

async function publish({ title, category, description, pdfBuffer }) {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  const storagePath = `${category}/${safeName}-${Date.now()}.pdf`;

  // Remove any previous version of this exact document (by title) so reruns
  // replace rather than duplicate.
  const { data: existing } = await supabase.from('data_room_documents').select('id, storage_path').eq('title', title);
  if (existing?.length) {
    await supabase.storage.from(BUCKET).remove(existing.map((d) => d.storage_path));
    await supabase.from('data_room_documents').delete().in('id', existing.map((d) => d.id));
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
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

// ── Document builders ─────────────────────────────────────────────────────────

async function capTableDoc() {
  const { data: entries } = await supabase.from('cap_table_entries').select('*').order('issued_at', { ascending: true, nullsFirst: false });
  const { data: vc } = await supabase.from('venture_config').select('*').single();

  const rows = (entries ?? []).map((e) => [
    e.holder_name, cap(e.holder_type), cap(e.instrument),
    e.shares?.toLocaleString('en-GB') ?? '—', e.share_class ?? '—',
    e.amount_pence != null ? gbp(e.amount_pence) : '—',
    [e.seis_eligible && 'SEIS', e.eis_eligible && 'EIS'].filter(Boolean).join('/') || '—',
    date(e.issued_at),
  ]);

  const pdf = await buildTablePDF({
    title: 'Cap Table Summary',
    subtitle: `${vc?.round_type ? cap(vc.round_type) + ' round' : ''}${vc?.target_raise_pence ? ` — targeting ${gbp(vc.target_raise_pence)}` : ''}`,
    columns: ['Holder', 'Type', 'Instrument', 'Shares', 'Class', 'Amount', 'Tax relief', 'Issued'],
    rows,
    note: vc ? `Cash in bank: ${gbp(vc.cash_in_bank_pence)} · Monthly burn: ${gbp(vc.monthly_burn_pence)} · SEIS advance assurance: ${vc.seis_advance_assurance ? 'received' : 'not yet received'} · EIS eligible: ${vc.eis_eligible ? 'yes' : 'no'}.` : undefined,
  });

  await publish({
    title: 'Cap Table Summary',
    category: 'financial',
    description: 'Current shareholding, option pool, and fundraise position — read directly from the company cap table.',
    pdfBuffer: pdf,
  });
}

async function valuationDoc() {
  const { data: snap } = await supabase.from('valuation_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single();
  if (!snap) return;

  const rows = Object.entries(snap.method_outputs ?? {}).map(([method, val]) => [method, gbp(val)]);

  const pdf = await buildTablePDF({
    title: snap.label,
    subtitle: `Range: ${gbp(snap.low_pence)} – ${gbp(snap.high_pence)}  ·  Midpoint: ${gbp(snap.mid_pence)}`,
    columns: ['Valuation method', 'Output'],
    rows,
    note: `MRR at time of snapshot: ${gbp(snap.mrr_pence)} · Total users: ${snap.total_users}. Methods shown (Berkus, Scorecard, VC Method, Comparables) are standard pre-revenue valuation frameworks; see /admin/valuation for full model inputs.`,
  });

  await publish({
    title: 'Valuation Analysis',
    category: 'financial',
    description: 'Pre-revenue valuation range across standard methodologies (Berkus, Scorecard, VC Method, Comparables), generated from the live valuation model.',
    pdfBuffer: pdf,
  });
}

async function fundingPipelineDoc() {
  const { data: grants } = await supabase.from('grants').select('*').order('deadline', { ascending: true, nullsFirst: false });
  const { data: ipFunding } = await supabase.from('ip_funding_items').select('*').order('created_at', { ascending: true });

  const rows = [
    ...(grants ?? []).map((g) => [g.name, g.funder, 'Grant', gbp(g.amount_pence), cap(g.status), date(g.deadline)]),
    ...(ipFunding ?? []).map((f) => [f.name, f.provider, 'IP Funding', `${gbp(f.min_amount_pence)}–${gbp(f.max_amount_pence)}`, cap(f.status), date(f.deadline)]),
  ];

  const pdf = await buildTablePDF({
    title: 'Grant & IP Funding Pipeline',
    subtitle: `${grants?.length ?? 0} grant applications, ${ipFunding?.length ?? 0} IP funding programmes tracked`,
    columns: ['Programme', 'Provider', 'Type', 'Amount', 'Status', 'Deadline'],
    rows,
  });

  await publish({
    title: 'Grant & IP Funding Pipeline',
    category: 'financial',
    description: 'Non-dilutive grant and IP-support funding programmes currently tracked, with status and deadlines.',
    pdfBuffer: pdf,
  });
}

async function ipAuditDoc() {
  const { data: items } = await supabase.from('ip_audit_items').select('*').order('priority', { ascending: true });

  const rows = (items ?? []).map((i) => [i.title, cap(i.category), cap(i.risk_level), cap(i.status), i.description]);

  const pdf = await buildTablePDF({
    title: 'IP & Contracts Audit',
    subtitle: `${items?.length ?? 0} items tracked across founder IP assignment, employment, and adviser agreements`,
    columns: ['Item', 'Category', 'Risk', 'Status', 'Description'],
    rows,
    note: 'Full evidence for each item is linked from /admin/ip-docs.',
  });

  await publish({
    title: 'IP & Contracts Audit',
    category: 'legal',
    description: 'IP ownership and assignment readiness — founder IP deed, employment IP clauses, adviser agreements — with current status and risk rating.',
    pdfBuffer: pdf,
  });
}

async function hazardLogDoc() {
  const { data: hazards } = await supabase.from('hazard_log').select('*').order('hazard_ref', { ascending: true });

  const rows = (hazards ?? []).map((h) => [
    h.hazard_ref, h.hazard_description, `${h.risk_level} (${h.risk_score})`,
    `${h.residual_risk_level} (${h.residual_risk_score})`, cap(h.status),
  ]);

  const pdf = await buildTablePDF({
    title: 'Clinical Safety Hazard Log',
    subtitle: `DCB0129 — ${hazards?.length ?? 0} hazards identified, assessed, and mitigated`,
    columns: ['Ref', 'Hazard', 'Initial risk', 'Residual risk', 'Status'],
    rows,
    note: 'Risk = severity × likelihood, scored 1–5 each (see /admin/hazard-log for full cause/effect/mitigation detail on every hazard).',
  });

  await publish({
    title: 'Clinical Safety Hazard Log',
    category: 'clinical',
    description: 'DCB0129 clinical safety hazard log — identified risks, mitigations, and residual risk ratings for the AI speech therapy platform.',
    pdfBuffer: pdf,
  });
}

async function complianceDoc() {
  const { data: items } = await supabase.from('compliance_items').select('*').order('framework', { ascending: true }).order('item_code', { ascending: true });

  const rows = (items ?? []).map((c) => [c.framework.toUpperCase(), c.item_code, cap(c.status), c.notes]);

  const byFramework = (items ?? []).reduce((acc, c) => { acc[c.framework] = (acc[c.framework] ?? 0) + 1; return acc; }, {});

  const pdf = await buildTablePDF({
    title: 'Compliance Framework Status',
    subtitle: Object.entries(byFramework).map(([f, n]) => `${f.toUpperCase()}: ${n} items`).join('  ·  '),
    columns: ['Framework', 'Item', 'Status', 'Notes'],
    rows,
  });

  await publish({
    title: 'Compliance Framework Status',
    category: 'regulatory',
    description: 'Current status against DTAC, DCB0129, and related NHS digital health compliance frameworks — item-by-item, as tracked in the compliance register.',
    pdfBuffer: pdf,
  });
}

async function roadmapDoc() {
  const { data: milestones } = await supabase.from('roadmap_milestones').select('*').order('target_date', { ascending: true, nullsFirst: false });

  const rows = (milestones ?? []).map((m) => [cap(m.phase), cap(m.category), m.title, cap(m.priority), cap(m.status), date(m.target_date)]);

  const pdf = await buildTablePDF({
    title: 'Product Roadmap',
    subtitle: `${milestones?.length ?? 0} milestones tracked across phases`,
    columns: ['Phase', 'Category', 'Milestone', 'Priority', 'Status', 'Target date'],
    rows,
  });

  await publish({
    title: 'Product Roadmap',
    category: 'corporate',
    description: 'Company milestones across product, compliance, and go-to-market phases, with current status and target dates.',
    pdfBuffer: pdf,
  });
}

async function main() {
  await capTableDoc();
  await valuationDoc();
  await fundingPipelineDoc();
  await ipAuditDoc();
  await hazardLogDoc();
  await complianceDoc();
  await roadmapDoc();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
