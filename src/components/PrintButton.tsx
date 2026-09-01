'use client';

import { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Flowen branded PDF generator
   Unit: pt (canonical PDF unit — avoids jsPDF mm-unit font-size ambiguity)
   Font sizes are in points, coordinates in points.
   Conversion: 1mm = 72/25.4 ≈ 2.8346 pt
═══════════════════════════════════════════════════════════════════════════ */

// ── Brand tokens ────────────────────────────────────────────────────────────
type RGB = [number, number, number];

const C = {
  navy:     [6,   8,   15]  as RGB,   // #06080F
  navyMid:  [12,  18,  38]  as RGB,   // lifted navy for depth panel
  emerald:  [16,  185, 129] as RGB,   // #10B981
  cyan:     [6,   182, 212] as RGB,   // #06B6D4
  amber:    [245, 158, 11]  as RGB,   // #F59E0B
  slate800: [30,  41,  59]  as RGB,
  slate700: [51,  65,  85]  as RGB,
  slate600: [71,  85,  105] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate400: [148, 163, 184] as RGB,
  slate300: [203, 213, 225] as RGB,
  slate100: [241, 245, 249] as RGB,
  slate50:  [248, 250, 252] as RGB,
  emerald50:[236, 253, 245] as RGB,
  amber50:  [255, 251, 235] as RGB,
  cyan50:   [236, 254, 255] as RGB,
  white:    [255, 255, 255] as RGB,
} as const;

// ── Gradient helpers ────────────────────────────────────────────────────────
function lerpCh(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function gradRGB(t: number): RGB {
  // amber(0) → emerald(0.42) → cyan(1.0)
  if (t <= 0.42) {
    const u = t / 0.42;
    return [lerpCh(C.amber[0], C.emerald[0], u), lerpCh(C.amber[1], C.emerald[1], u), lerpCh(C.amber[2], C.emerald[2], u)];
  }
  const u = (t - 0.42) / 0.58;
  return [lerpCh(C.emerald[0], C.cyan[0], u), lerpCh(C.emerald[1], C.cyan[1], u), lerpCh(C.emerald[2], C.cyan[2], u)];
}

// ── Canvas wave logo (gradient supported, PNG embedded in PDF) ───────────────
function renderWavePng(cw: number, ch: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sx = cw / 120, sy = ch / 60;
  const grad = ctx.createLinearGradient(0, 0, cw, 0);
  grad.addColorStop(0, '#F59E0B');
  grad.addColorStop(0.35, '#10B981');
  grad.addColorStop(1, '#06B6D4');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 4.5 * sx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Paths from /public/email-logo.svg (viewBox 120×60)
  ctx.beginPath();
  ctx.moveTo(10*sx, 25*sy);
  ctx.bezierCurveTo(20*sx,25*sy, 25*sx,38*sy, 35*sx,38*sy);
  ctx.bezierCurveTo(48*sx,38*sy, 52*sx,12*sy, 65*sx,12*sy);
  ctx.bezierCurveTo(78*sx,12*sy, 82*sx,42*sy, 95*sx,42*sy);
  ctx.bezierCurveTo(105*sx,42*sy, 108*sx,30*sy, 115*sx,30*sy);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10*sx, 33*sy);
  ctx.bezierCurveTo(20*sx,33*sy, 25*sx,46*sy, 35*sx,46*sy);
  ctx.bezierCurveTo(48*sx,46*sy, 52*sx,20*sy, 65*sx,20*sy);
  ctx.bezierCurveTo(78*sx,20*sy, 82*sx,50*sy, 95*sx,50*sy);
  ctx.bezierCurveTo(105*sx,50*sy, 108*sx,38*sy, 115*sx,38*sy);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

// ── jsPDF colour helpers ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;
const setF = (d: Doc, c: RGB) => d.setFillColor(c[0], c[1], c[2]);
const setT = (d: Doc, c: RGB) => d.setTextColor(c[0], c[1], c[2]);

function gradBar(d: Doc, x: number, y: number, w: number, h: number, steps = 90) {
  for (let i = 0; i < steps; i++) {
    const [r, g, b] = gradRGB(i / (steps - 1));
    d.setFillColor(r, g, b);
    d.rect(x + (i / steps) * w, y, w / steps + 0.8, h, 'F');
  }
}

// ── DOM content model ───────────────────────────────────────────────────────
type CalloutVariant = 'info' | 'warning' | 'tip';

interface TextNode    { kind: 'h2'|'h3'|'h4'|'p'|'li'|'blockquote'; text: string }
interface CalloutNode { kind: 'callout'; variant: CalloutVariant; paras: string[] }
interface TableNode   { kind: 'table'; headers: string[]; rows: string[][] }
type PdfNode = TextNode | CalloutNode | TableNode;

/** Walk the DOM subtree and extract structured content nodes. */
function walkDOM(el: Element): PdfNode[] {
  const out: PdfNode[] = [];
  for (const child of Array.from(el.children) as Element[]) {
    const tag = child.tagName;
    const cls = typeof child.className === 'string' ? child.className : '';

    if (tag === 'H2') {
      const t = child.textContent?.trim(); if (t) out.push({ kind: 'h2', text: t });

    } else if (tag === 'H3') {
      const t = child.textContent?.trim(); if (t) out.push({ kind: 'h3', text: t });

    } else if (tag === 'H4') {
      const t = child.textContent?.trim(); if (t) out.push({ kind: 'h4', text: t });

    } else if (tag === 'P') {
      const t = child.textContent?.replace(/\s+/g, ' ').trim();
      if (t) out.push({ kind: 'p', text: t });

    } else if (tag === 'UL' || tag === 'OL') {
      for (const li of Array.from(child.querySelectorAll('li'))) {
        const t = li.textContent?.replace(/\s+/g, ' ').trim();
        if (t) out.push({ kind: 'li', text: t });
      }

    } else if (tag === 'BLOCKQUOTE') {
      const t = child.textContent?.replace(/\s+/g, ' ').trim();
      if (t) out.push({ kind: 'blockquote', text: t });

    } else if (cls.includes('doc-callout')) {
      // DocCallout — collect child paragraphs and detect variant from Tailwind classes
      const paras = Array.from(child.querySelectorAll('p, li'))
        .map(p => p.textContent?.replace(/\s+/g, ' ').trim())
        .filter(Boolean) as string[];
      let variant: CalloutVariant = 'info';
      if (cls.includes('amber')) variant = 'warning';
      if (cls.includes('cyan'))  variant = 'tip';
      if (paras.length) out.push({ kind: 'callout', variant, paras });

    } else if (cls.includes('doc-table')) {
      // DocTable — structured table with headers and body rows
      const headers = Array.from(child.querySelectorAll('thead th'))
        .map(th => th.textContent?.trim() ?? '');
      const rows: string[][] = Array.from(child.querySelectorAll('tbody tr'))
        .map(tr => Array.from(tr.querySelectorAll('td'))
          .map(td => td.textContent?.replace(/\s+/g, ' ').trim() ?? ''))
        .filter(r => r.some(c => c));
      if (headers.length || rows.length) out.push({ kind: 'table', headers, rows });

    } else {
      // Generic wrapper (div, section, article, etc.) — recurse in
      out.push(...walkDOM(child));
    }
  }
  return out;
}

// ── Layout constants (all in pt — canonical PDF unit) ───────────────────────
const PW = 595.28;  // A4 width
const PH = 841.89;  // A4 height
const MM = 72 / 25.4;  // pt per mm (≈ 2.8346)

const MX = 17 * MM;          // horizontal margin = 17mm = 48.2pt
const CW = PW - 2 * MX;      // content width = 176mm = 498.9pt

const COVER_H    = 58 * MM;          // navy cover block = 58mm = 164.4pt
const GRAD_BAR_H = 3  * MM;          // accent gradient strip = 8.5pt
const COVER_FULL = COVER_H + GRAD_BAR_H;  // 172.9pt

const MINI_H    = 12 * MM;           // running header = 34pt
const MINI_GRAD = 2  * MM;           // mini gradient strip = 5.7pt
const MINI_FULL = MINI_H + MINI_GRAD; // 39.7pt

const FOOT_ZONE = 14 * MM;           // bottom reserved = 39.7pt
const BODY_SAFE = PH - FOOT_ZONE - 4 * MM;  // = 790.9pt

// Font sizes in POINTS — correct for unit:'pt'
// jsPDF with unit:'pt' treats setFontSize(n) as n points
const FS = {
  cover_title: 22,
  cover_sub:   10,
  cover_tag:   7,
  cover_wm:    13,
  h2: 14,
  h3: 12,
  h4: 10.5,
  body: 9.5,
  li:   9.5,
  td:   8.5,
  th:   8.5,
  foot: 7.5,
  mini_wm: 8,
  mini_doc: 7,
} as const;

// Line height factor — jsPDF default is 1.15
const LHF = 1.15;
function lh(fs: number): number { return fs * LHF; }

// ── Table renderer ──────────────────────────────────────────────────────────
function renderTable(
  d: Doc,
  headers: string[],
  rows: string[][],
  x: number,
  startY: number,
  width: number,
): number {
  const numCols = Math.max(headers.length, ...rows.map(r => r.length), 1);
  const colW    = width / numCols;
  const PAD_X   = 5;   // pt padding inside each cell
  const PAD_Y   = 5;   // pt top/bottom padding
  const cellW   = colW - PAD_X * 2;
  let y = startY;

  d.setFontSize(FS.th);
  const LH_TH = lh(FS.th);

  // ── Header row ─────────────────────────────────────────────────────────
  if (headers.length > 0) {
    const maxLines = headers.reduce((m, h) => Math.max(m, d.splitTextToSize(h, cellW).length), 1);
    const rowH = maxLines * LH_TH + PAD_Y * 2;

    setF(d, C.navy);
    d.rect(x, y, width, rowH, 'F');

    d.setFont('helvetica', 'bold');
    setT(d, C.emerald);
    headers.forEach((hdr, i) => {
      const lines = d.splitTextToSize(hdr, cellW);
      d.text(lines, x + i * colW + PAD_X, y + PAD_Y + LH_TH * 0.82);
    });
    y += rowH;
  }

  // ── Body rows ───────────────────────────────────────────────────────────
  d.setFontSize(FS.td);
  const LH_TD = lh(FS.td);

  rows.forEach((row, ri) => {
    const maxLines = row.reduce((m, cell) => Math.max(m, d.splitTextToSize(cell, cellW).length), 1);
    const rowH = maxLines * LH_TD + PAD_Y * 2;

    // Alternating row tint
    if (ri % 2 === 0) {
      setF(d, C.slate50);
      d.rect(x, y, width, rowH, 'F');
    }
    // Bottom border
    setF(d, C.slate300);
    d.rect(x, y + rowH, width, 0.4, 'F');

    d.setFont('helvetica', 'normal');
    row.forEach((cell, ci) => {
      const lines = d.splitTextToSize(cell, cellW);
      // First column slightly bolder
      if (ci === 0) {
        d.setFont('helvetica', 'bold');
        setT(d, C.slate800);
      } else {
        d.setFont('helvetica', 'normal');
        setT(d, C.slate700);
      }
      d.text(lines, x + ci * colW + PAD_X, y + PAD_Y + LH_TD * 0.82);
    });
    y += rowH;
  });

  // Outer border (bottom + outer frame via thin rect outline)
  setF(d, C.slate300);
  d.rect(x, y, width, 0.6, 'F');

  return y;
}

// ── Main PDF generator ───────────────────────────────────────────────────────
async function downloadAsPdf(titleProp: string, contentSelector: string) {
  const { jsPDF } = await import('jspdf');

  // Render wave logo at 3× for crisp PDF embedding
  const wavePng = renderWavePng(360, 180);

  // ── DOM metadata ────────────────────────────────────────────────────────
  const h1Text =
    titleProp ||
    document.querySelector('h1')?.textContent?.trim() ||
    'Document';

  const tagEl      = document.querySelector<HTMLElement>('.doc-tag');
  const subtitleEl = document.querySelector<HTMLElement>('.doc-subtitle');
  const metaEl     = document.querySelector<HTMLElement>('.doc-meta');

  // ── Extract content ──────────────────────────────────────────────────────
  const container =
    document.querySelector(contentSelector) ??
    document.querySelector('.doc-content') ??
    document.querySelector('.prose-sm') ??
    document.querySelector('main');

  const nodes: PdfNode[] = container ? walkDOM(container) : [];

  // ── Create document (unit:'pt' — the canonical PDF unit) ─────────────────
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  let y       = 0;
  let pageNum = 1;

  // ── Footer ────────────────────────────────────────────────────────────────
  function writeFooter() {
    const fy = PH - FOOT_ZONE + 6 * MM;

    // Gradient hairline
    gradBar(doc, 0, PH - FOOT_ZONE + 1, PW, 1.2, 70);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FS.foot);
    setT(doc, C.slate500);
    doc.text('Flowen Speech Technology Ltd  ·  flowen.digital', MX, fy);
    doc.text(String(pageNum), PW - MX, fy, { align: 'right' });
  }

  // ── Running header (pages 2+) ─────────────────────────────────────────────
  function writeMiniHeader() {
    setF(doc, C.navy);
    doc.rect(0, 0, PW, MINI_H, 'F');

    if (wavePng) {
      try { doc.addImage(wavePng, 'PNG', MX, 1.5 * MM, 20 * MM, 10 * MM); } catch (_) { /* skip */ }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS.mini_wm);
    setT(doc, C.white);
    doc.text('FLOWEN', MX + 22 * MM, MINI_H * 0.6);

    const short = h1Text.length > 60 ? h1Text.slice(0, 57) + '…' : h1Text;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FS.mini_doc);
    setT(doc, C.slate400);
    doc.text(short, PW - MX, MINI_H * 0.6, { align: 'right' });

    gradBar(doc, 0, MINI_H, PW, MINI_GRAD, 80);
  }

  // ── Cover block (page 1) ──────────────────────────────────────────────────
  function writeCover() {
    // Navy panel
    setF(doc, C.navy);
    doc.rect(0, 0, PW, COVER_H, 'F');

    // Subtle depth: lighter panel on right ~28%
    setF(doc, C.navyMid);
    doc.rect(PW * 0.72, 0, PW * 0.28, COVER_H, 'F');

    // Wave logo
    if (wavePng) {
      try { doc.addImage(wavePng, 'PNG', MX, 10 * MM, 22 * MM, 11 * MM); } catch (_) { /* skip */ }
    }

    // FLOWEN wordmark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS.cover_wm);
    setT(doc, C.white);
    doc.text('FLOWEN', MX + 26 * MM, 17 * MM);

    // Category tag
    const tagText = tagEl?.textContent?.trim().toUpperCase();
    if (tagText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FS.cover_tag);
      setT(doc, C.emerald);
      doc.text(tagText, MX + 26 * MM, 23 * MM);
    }

    // Separator rule below logo row
    setF(doc, C.slate800);
    doc.rect(MX, 28 * MM, CW, 0.5, 'F');

    // Document title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FS.cover_title);
    setT(doc, C.white);
    const titleLines = doc.splitTextToSize(h1Text, CW) as string[];
    doc.text(titleLines, MX, 36 * MM);
    let yc = 36 * MM + titleLines.length * lh(FS.cover_title);

    // Subtitle
    const subText = subtitleEl?.textContent?.replace(/\s+/g, ' ').trim();
    if (subText && yc + 20 * MM < COVER_H) {
      yc += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FS.cover_sub);
      setT(doc, C.slate400);
      const subLines = doc.splitTextToSize(subText, CW) as string[];
      doc.text(subLines, MX, yc);
      yc += subLines.length * lh(FS.cover_sub);
    }

    // Meta (date, read time, organisation)
    const metaText = metaEl?.textContent?.replace(/\s+/g, ' ').trim();
    if (metaText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FS.foot);
      setT(doc, C.slate600);
      doc.text(metaText, MX, COVER_H - 6 * MM);
    }

    // Gradient accent bar
    gradBar(doc, 0, COVER_H, PW, GRAD_BAR_H, 100);
  }

  // ── Page break ────────────────────────────────────────────────────────────
  function addPage() {
    writeFooter();
    doc.addPage();
    pageNum++;
    writeMiniHeader();
    y = MINI_FULL + 8 * MM;
  }

  function guard(needed: number, extra = 0) {
    if (y + needed + extra > BODY_SAFE) addPage();
  }

  // ── Callout renderer ─────────────────────────────────────────────────────
  function renderCallout(variant: CalloutVariant, paras: string[]) {
    const PAD_X = 6 * MM;
    const PAD_Y = 5 * MM;
    const innerW = CW - PAD_X * 2 - 2.5 * MM;  // inset from left border

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FS.body);
    const LH_BODY = lh(FS.body);

    // Calculate total height needed
    let totalLines = 0;
    for (const p of paras) {
      totalLines += Math.max(1, doc.splitTextToSize(p, innerW).length);
      totalLines += 0.5;  // inter-paragraph gap in lines
    }
    const boxH = totalLines * LH_BODY + PAD_Y * 2;

    guard(boxH + 6 * MM);
    y += 3 * MM;

    // Background and left border by variant
    const [bgColor, borderColor] = {
      info:    [C.emerald50, C.emerald],
      warning: [C.amber50,   C.amber],
      tip:     [C.cyan50,    C.cyan],
    }[variant];

    setF(doc, bgColor);
    doc.rect(MX, y, CW, boxH, 'F');
    setF(doc, borderColor);
    doc.rect(MX, y, 3, boxH, 'F');

    let ty = y + PAD_Y + LH_BODY * 0.82;
    setT(doc, C.slate800);

    for (const p of paras) {
      const lines = doc.splitTextToSize(p, innerW) as string[];
      doc.text(lines, MX + PAD_X, ty);
      ty += lines.length * LH_BODY + LH_BODY * 0.5;
    }

    y += boxH + 4 * MM;
  }

  // ── Body node renderer ───────────────────────────────────────────────────
  function renderNode(node: PdfNode) {
    if (node.kind === 'callout') {
      renderCallout(node.variant, node.paras);
      return;
    }

    if (node.kind === 'table') {
      // Estimate table height for guard
      const numRows   = node.rows.length + (node.headers.length ? 1 : 0);
      const estHeight = numRows * 18 * MM;  // rough: each row ≈ 18pt
      guard(estHeight + 4 * MM);
      y += 3 * MM;
      const newY = renderTable(doc, node.headers, node.rows, MX, y, CW);
      y = newY + 6 * MM;
      return;
    }

    // Text-based nodes
    const { kind, text } = node;

    switch (kind) {
      case 'h2': {
        const lines = doc.splitTextToSize(text, CW - 4 * MM) as string[];
        const blockH = lines.length * lh(FS.h2);
        // Anti-orphan: ensure heading + at least 2 body lines fit before breaking
        guard(blockH + 2 * lh(FS.body) + 22 * MM);

        y += 8 * MM;  // spacer before H2

        // Emerald left rail
        setF(doc, C.emerald);
        doc.rect(MX, y - FS.h2 * 0.8, 2.5 * MM, blockH + 1.5 * MM, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FS.h2);
        setT(doc, C.emerald);
        doc.text(lines, MX + 4 * MM, y);
        y += blockH + 1.5 * MM;

        // Thin slate rule
        setF(doc, C.slate300);
        doc.rect(MX, y, CW, 0.4, 'F');
        y += 4 * MM;
        break;
      }

      case 'h3': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FS.h3);
        const lines = doc.splitTextToSize(text, CW) as string[];
        const blockH = lines.length * lh(FS.h3);
        guard(blockH + lh(FS.body) + 14 * MM);

        y += 5 * MM;

        // Cyan dot accent
        setF(doc, C.cyan);
        doc.circle(MX + 1.4 * MM, y - FS.h3 * 0.4, 1.4 * MM, 'F');

        setT(doc, C.cyan);
        doc.text(lines, MX + 4.5 * MM, y);
        y += blockH + 2 * MM;
        break;
      }

      case 'h4': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(FS.h4);
        const lines = doc.splitTextToSize(text, CW) as string[];
        const blockH = lines.length * lh(FS.h4);
        guard(blockH + lh(FS.body) + 10 * MM);
        y += 3.5 * MM;
        setT(doc, C.slate800);
        doc.text(lines, MX, y);
        y += blockH + 2 * MM;
        break;
      }

      case 'p': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FS.body);
        const lines = doc.splitTextToSize(text, CW) as string[];
        const blockH = lines.length * lh(FS.body);
        guard(blockH + 4 * MM);
        setT(doc, C.slate700);
        doc.text(lines, MX, y);
        y += blockH + 3.5 * MM;
        break;
      }

      case 'li': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(FS.li);
        const INDENT = 4.5 * MM;
        const lines  = doc.splitTextToSize(text, CW - INDENT) as string[];
        const blockH = lines.length * lh(FS.li);
        guard(blockH + 2 * MM);

        // Emerald filled bullet
        setF(doc, C.emerald);
        doc.circle(MX + 1.5 * MM, y - FS.li * 0.38, 1.1 * MM, 'F');

        setT(doc, C.slate700);
        doc.text(lines, MX + INDENT, y);
        y += blockH + 2 * MM;
        break;
      }

      case 'blockquote': {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(FS.body);
        const INDENT = 5 * MM;
        const lines  = doc.splitTextToSize(text, CW - INDENT - 3 * MM) as string[];
        const blockH = lines.length * lh(FS.body);
        const boxH   = blockH + 8 * MM;
        guard(boxH + 4 * MM);
        y += 3 * MM;

        setF(doc, C.amber50);
        doc.rect(MX, y - 4 * MM, CW, boxH, 'F');
        setF(doc, C.amber);
        doc.rect(MX, y - 4 * MM, 3, boxH, 'F');

        setT(doc, C.slate800);
        doc.text(lines, MX + INDENT, y);
        y += boxH + 2 * MM;
        break;
      }
    }
  }

  // ── Build document ────────────────────────────────────────────────────────
  writeCover();
  y = COVER_FULL + 8 * MM;

  for (const node of nodes) {
    renderNode(node);
  }

  writeFooter();

  const slug = h1Text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`flowen-${slug}.pdf`);
}

// ── React component ──────────────────────────────────────────────────────────
interface Props {
  title?: string;
  contentSelector?: string;
}

export default function PrintButton({ title, contentSelector = '.doc-content' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await downloadAsPdf(title ?? '', contentSelector);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all print:hidden disabled:opacity-60 disabled:cursor-wait"
    >
      {loading ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
      {loading ? 'Generating…' : 'Download PDF'}
    </button>
  );
}
