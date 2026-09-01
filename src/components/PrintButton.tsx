'use client';

import { useState } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   Flowen brand tokens — mirrors the design system
───────────────────────────────────────────────────────────────────────────── */
type RGB = [number, number, number];

const C = {
  navy:     [6,   8,   15]  as RGB,  // #06080F  — deep background
  navyMid:  [13,  20,  40]  as RGB,  // slightly lifted for layering
  emerald:  [16,  185, 129] as RGB,  // #10B981  — primary brand accent
  cyan:     [6,   182, 212] as RGB,  // #06B6D4  — secondary accent
  amber:    [245, 158, 11]  as RGB,  // #F59E0B  — tertiary / warmth
  slate900: [15,  23,  42]  as RGB,
  slate800: [30,  41,  59]  as RGB,
  slate700: [51,  65,  85]  as RGB,
  slate600: [71,  85,  105] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate400: [148, 163, 184] as RGB,
  slate300: [203, 213, 225] as RGB,
  slate100: [241, 245, 249] as RGB,
  white:    [255, 255, 255] as RGB,
  amber50:  [255, 251, 235] as RGB,
  emerald50:[236, 253, 245] as RGB,
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
   Colour helpers
───────────────────────────────────────────────────────────────────────────── */
function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/** Amber → Emerald → Cyan gradient at position t ∈ [0,1]. */
function gradRGB(t: number): RGB {
  const pivot = 0.42;
  if (t <= pivot) {
    const u = t / pivot;
    return [
      lerpChannel(C.amber[0], C.emerald[0], u),
      lerpChannel(C.amber[1], C.emerald[1], u),
      lerpChannel(C.amber[2], C.emerald[2], u),
    ];
  }
  const u = (t - pivot) / (1 - pivot);
  return [
    lerpChannel(C.emerald[0], C.cyan[0], u),
    lerpChannel(C.emerald[1], C.cyan[1], u),
    lerpChannel(C.emerald[2], C.cyan[2], u),
  ];
}

/* ─────────────────────────────────────────────────────────────────────────────
   Wave logo — rendered to canvas for gradient support
   Uses the same bezier paths as /public/email-logo.svg (120×60 viewBox)
───────────────────────────────────────────────────────────────────────────── */
function renderWavePng(canvasW: number, canvasH: number): string {
  const el = document.createElement('canvas');
  el.width  = canvasW;
  el.height = canvasH;
  const ctx = el.getContext('2d');
  if (!ctx) return '';

  const sx = canvasW / 120;
  const sy = canvasH / 60;

  const grad = ctx.createLinearGradient(0, 0, canvasW, 0);
  grad.addColorStop(0,    '#F59E0B');
  grad.addColorStop(0.35, '#10B981');
  grad.addColorStop(1,    '#06B6D4');

  ctx.strokeStyle = grad;
  ctx.lineWidth   = 4.5 * sx;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Wave 1
  ctx.beginPath();
  ctx.moveTo(10 * sx, 25 * sy);
  ctx.bezierCurveTo(20 * sx, 25 * sy, 25 * sx, 38 * sy, 35 * sx, 38 * sy);
  ctx.bezierCurveTo(48 * sx, 38 * sy, 52 * sx, 12 * sy, 65 * sx, 12 * sy);
  ctx.bezierCurveTo(78 * sx, 12 * sy, 82 * sx, 42 * sy, 95 * sx, 42 * sy);
  ctx.bezierCurveTo(105 * sx, 42 * sy, 108 * sx, 30 * sy, 115 * sx, 30 * sy);
  ctx.stroke();

  // Wave 2
  ctx.beginPath();
  ctx.moveTo(10 * sx, 33 * sy);
  ctx.bezierCurveTo(20 * sx, 33 * sy, 25 * sx, 46 * sy, 35 * sx, 46 * sy);
  ctx.bezierCurveTo(48 * sx, 46 * sy, 52 * sx, 20 * sy, 65 * sx, 20 * sy);
  ctx.bezierCurveTo(78 * sx, 20 * sy, 82 * sx, 50 * sy, 95 * sx, 50 * sy);
  ctx.bezierCurveTo(105 * sx, 50 * sy, 108 * sx, 38 * sy, 115 * sx, 38 * sy);
  ctx.stroke();

  return el.toDataURL('image/png');
}

/* ─────────────────────────────────────────────────────────────────────────────
   jsPDF convenience wrappers
───────────────────────────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

function setFill(d: Doc, c: RGB) { d.setFillColor(c[0], c[1], c[2]); }
function setTxt(d: Doc,  c: RGB) { d.setTextColor(c[0], c[1], c[2]); }

/** Draws the amber→emerald→cyan gradient bar at (x, y) of size (w × h). */
function gradientBar(d: Doc, x: number, y: number, w: number, h: number, steps = 90) {
  for (let i = 0; i < steps; i++) {
    const [r, g, b] = gradRGB(i / (steps - 1));
    d.setFillColor(r, g, b);
    d.rect(x + (i / steps) * w, y, w / steps + 0.4, h, 'F');
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   PDF layout constants (A4)
───────────────────────────────────────────────────────────────────────────── */
const PW = 210;  // page width  mm
const PH = 297;  // page height mm
const MX = 17;   // horizontal margin
const CW = PW - MX * 2;  // content width = 176mm

const COVER_H      = 54;   // navy cover block height
const GRAD_BAR_H   = 3;    // gradient accent bar
const COVER_TOTAL  = COVER_H + GRAD_BAR_H;

const MINI_H       = 12;   // running header on subsequent pages
const MINI_GRAD_H  = 2;
const MINI_TOTAL   = MINI_H + MINI_GRAD_H;

const FOOTER_ZONE  = 14;   // mm reserved at bottom (including the rule line)
const BODY_SAFE    = PH - FOOTER_ZONE - 4;  // absolute y at which to page-break

/* ─────────────────────────────────────────────────────────────────────────────
   Main PDF generator
───────────────────────────────────────────────────────────────────────────── */
async function downloadAsPdf(titleProp: string, contentSelector: string) {
  const { jsPDF } = await import('jspdf');

  // ── Render wave logo at 3× for crisp output ──────────────────────────────
  const wavePng = renderWavePng(360, 180);

  // ── Gather DOM content ────────────────────────────────────────────────────
  const h1Text =
    titleProp ||
    document.querySelector('h1')?.textContent?.trim() ||
    'Document';

  const tagEl      = document.querySelector<HTMLElement>('.doc-tag');
  const subtitleEl = document.querySelector<HTMLElement>('.doc-subtitle');
  const metaEl     = document.querySelector<HTMLElement>('.doc-meta');

  const container =
    document.querySelector(contentSelector) ??
    document.querySelector('.doc-content') ??
    document.querySelector('.prose-sm') ??
    document.querySelector('main');

  const nodes = container
    ? Array.from(container.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,td,th,blockquote,dt,dd'))
    : [];

  // ── Create document ───────────────────────────────────────────────────────
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  let y        = 0;
  let pageNum  = 1;
  let onFirst  = true;

  // ── Footer ────────────────────────────────────────────────────────────────
  function writeFooter() {
    // Gradient hairline
    gradientBar(doc, 0, PH - FOOTER_ZONE + 0.5, PW, 0.5, 70);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setTxt(doc, C.slate500);
    doc.text(
      'Flowen Speech Technology Ltd  ·  flowen.digital',
      MX,
      PH - FOOTER_ZONE + 6,
    );
    doc.text(
      String(pageNum),
      PW - MX,
      PH - FOOTER_ZONE + 6,
      { align: 'right' },
    );
  }

  // ── Running header (pages 2+) ─────────────────────────────────────────────
  function writeMiniHeader() {
    setFill(doc, C.navy);
    doc.rect(0, 0, PW, MINI_H, 'F');

    // Wave mark — small
    if (wavePng) {
      try { doc.addImage(wavePng, 'PNG', MX, 1.8, 10, 5); } catch (_) { /* skip */ }
    }

    // Wordmark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setTxt(doc, C.white);
    doc.text('FLOWEN', MX + 12.5, 7);

    // Document title — truncated, right-aligned, slate-400
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTxt(doc, C.slate400);
    const short = h1Text.length > 55 ? h1Text.slice(0, 52) + '…' : h1Text;
    doc.text(short, PW - MX, 7, { align: 'right' });

    // Gradient accent bar
    gradientBar(doc, 0, MINI_H, PW, MINI_GRAD_H, 80);
  }

  // ── Cover header (page 1) ─────────────────────────────────────────────────
  function writeCoverHeader() {
    // Deep navy block
    setFill(doc, C.navy);
    doc.rect(0, 0, PW, COVER_H, 'F');

    // Subtle secondary tone strip — adds depth on the right ~30%
    setFill(doc, C.navyMid);
    doc.rect(PW * 0.68, 0, PW * 0.32, COVER_H, 'F');

    // Wave logo
    if (wavePng) {
      try { doc.addImage(wavePng, 'PNG', MX, 8, 22, 11); } catch (_) { /* skip */ }
    }

    // "FLOWEN" wordmark
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setTxt(doc, C.white);
    doc.text('FLOWEN', MX + 25, 17);

    // Tag / category (emerald pill text)
    const tagText = tagEl?.textContent?.trim().toUpperCase();
    if (tagText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      setTxt(doc, C.emerald);
      doc.text(tagText, MX + 25, 23.5);
    }

    // Thin separator rule under logo row
    setFill(doc, C.slate800);
    doc.rect(MX, 27, CW, 0.3, 'F');

    // Document title — white, large
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    setTxt(doc, C.white);
    const titleLines = doc.splitTextToSize(h1Text, CW) as string[];
    doc.text(titleLines, MX, 36);

    let yc = 36 + titleLines.length * 8.5;

    // Subtitle — slate-400, smaller
    const subText = subtitleEl?.textContent?.trim();
    if (subText && yc + 10 < COVER_H - 2) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setTxt(doc, C.slate400);
      const subLines = doc.splitTextToSize(subText, CW) as string[];
      const subH = subLines.length * 4.8;
      if (yc + subH < COVER_H - 5) {
        doc.text(subLines, MX, yc);
        yc += subH + 2;
      }
    }

    // Meta — slate-600, bottom of block
    const metaText = metaEl?.textContent?.trim();
    if (metaText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      setTxt(doc, C.slate600);
      doc.text(metaText, MX, COVER_H - 4);
    }

    // Gradient accent bar
    gradientBar(doc, 0, COVER_H, PW, GRAD_BAR_H, 100);
  }

  // ── Page break ───────────────────────────────────────────────────────────
  function addPage() {
    writeFooter();
    doc.addPage();
    pageNum++;
    onFirst = false;
    writeMiniHeader();
    y = MINI_TOTAL + 7;
  }

  function guard(needed: number) {
    if (y + needed > BODY_SAFE) addPage();
  }

  // ── Initialise page 1 ────────────────────────────────────────────────────
  writeCoverHeader();
  y = COVER_TOTAL + 8;

  // ── Render body nodes ─────────────────────────────────────────────────────
  for (const el of nodes) {
    const raw = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!raw) continue;

    const tag = el.tagName;

    switch (tag) {

      case 'H1':
        // Already rendered in the cover block; skip.
        break;

      case 'H2': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        const lines = doc.splitTextToSize(raw, CW - 6) as string[];
        const blockH = lines.length * 6.5;
        guard(8 + blockH + 5);
        y += 7;

        // Emerald left rail
        setFill(doc, C.emerald);
        doc.rect(MX, y - 4.5, 2.5, blockH + 2, 'F');

        setTxt(doc, C.emerald);
        doc.text(lines, MX + 6, y);
        y += blockH + 2;

        // Subtle rule below
        setFill(doc, C.slate300);
        doc.rect(MX, y, CW, 0.25, 'F');
        y += 4;
        break;
      }

      case 'H3': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(raw, CW) as string[];
        guard(5 + lines.length * 6 + 3);
        y += 5;

        // Cyan dot accent
        setFill(doc, C.cyan);
        doc.circle(MX + 1.2, y - 2, 1.2, 'F');

        setTxt(doc, C.cyan);
        doc.text(lines, MX + 5.5, y);
        y += lines.length * 6 + 2;
        break;
      }

      case 'H4': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const lines = doc.splitTextToSize(raw, CW) as string[];
        guard(4 + lines.length * 5.5 + 2);
        y += 4;
        setTxt(doc, C.slate800);
        doc.text(lines, MX, y);
        y += lines.length * 5.5 + 2;
        break;
      }

      case 'LI': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(raw, CW - 6) as string[];
        guard(lines.length * 5.2 + 1.5);

        // Emerald filled bullet
        setFill(doc, C.emerald);
        doc.circle(MX + 2, y - 1.4, 0.85, 'F');

        setTxt(doc, C.slate700);
        doc.text(lines, MX + 6, y);
        y += lines.length * 5.2 + 1.5;
        break;
      }

      case 'TH': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        const lines = doc.splitTextToSize(raw, CW / 3) as string[];
        guard(lines.length * 5 + 1);
        setTxt(doc, C.emerald);
        doc.text(lines, MX, y);
        y += lines.length * 5 + 0.5;
        break;
      }

      case 'TD': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(raw, CW) as string[];
        guard(lines.length * 5 + 1);
        setTxt(doc, C.slate700);
        doc.text(lines, MX + 2, y);
        y += lines.length * 5 + 1;
        break;
      }

      case 'BLOCKQUOTE': {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(raw, CW - 10) as string[];
        const bH = lines.length * 5.2 + 8;
        guard(bH + 5);
        y += 3;

        // Amber background tint
        setFill(doc, C.amber50);
        doc.rect(MX, y - 4, CW, bH, 'F');

        // Amber left border
        setFill(doc, C.amber);
        doc.rect(MX, y - 4, 2.5, bH, 'F');

        setTxt(doc, C.slate800);
        doc.text(lines, MX + 8, y);
        y += bH + 3;
        break;
      }

      case 'DT': {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(raw, CW) as string[];
        guard(3 + lines.length * 5.2);
        y += 3;
        setTxt(doc, C.slate800);
        doc.text(lines, MX, y);
        y += lines.length * 5.2;
        break;
      }

      case 'DD': {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(raw, CW - 7) as string[];
        guard(lines.length * 5.2 + 1);
        setTxt(doc, C.slate600);
        doc.text(lines, MX + 7, y);
        y += lines.length * 5.2 + 2;
        break;
      }

      default: {
        // P and everything else
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(raw, CW) as string[];
        guard(lines.length * 5.2 + 4);
        setTxt(doc, C.slate700);
        doc.text(lines, MX, y);
        y += lines.length * 5.2 + 4;
        break;
      }
    }
  }

  writeFooter();

  const slug = h1Text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  doc.save(`flowen-${slug}.pdf`);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */
interface Props {
  /** PDF title and filename stem — defaults to the page <h1> text. */
  title?: string;
  /** CSS selector for the main content container. */
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
