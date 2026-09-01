'use client';

import { useState } from 'react';

interface Props {
  /** Suggested filename (no extension) and PDF title — defaults to the page <h1> text. */
  title?: string;
  /** CSS selector for the content container. Defaults to '.doc-content', falls back to '.prose-sm'. */
  contentSelector?: string;
}

async function downloadAsPdf(title: string, contentSelector: string) {
  // Dynamic import — no bundle cost unless the user actually clicks the button.
  const { jsPDF } = await import('jspdf');

  // ── Gather content from the DOM ─────────────────────────────────────────────
  const h1Text =
    title ||
    (document.querySelector('h1')?.textContent?.trim() ?? 'Document');

  const container =
    document.querySelector(contentSelector) ??
    document.querySelector('.doc-content') ??
    document.querySelector('.prose-sm') ??
    document.querySelector('main');

  if (!container) {
    // Last resort: open print dialog so the user is never left with nothing.
    window.print();
    return;
  }

  // Walk the headings and text blocks in document order.
  const nodes = container.querySelectorAll<HTMLElement>(
    'h1, h2, h3, h4, p, li, td, th, blockquote',
  );

  // ── PDF layout constants ───────────────────────────────────────────────────
  const PAGE_W = 210; // A4 mm
  const PAGE_H = 297;
  const MARGIN_X = 18;
  const MARGIN_Y = 20;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const FOOTER_H = 12; // reserved at bottom for page numbers
  const MAX_Y = PAGE_H - MARGIN_Y - FOOTER_H;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Colour palette (works for light PDF on white background)
  const BRAND_GREEN = '#10B981';
  const TEXT_DARK   = '#111827';
  const TEXT_MID    = '#374151';
  const TEXT_LIGHT  = '#6B7280';
  const RULE_COLOR  = '#D1FAE5'; // light emerald rule under title

  // ── Page helper ────────────────────────────────────────────────────────────
  let y = MARGIN_Y;
  let pageNum = 1;

  function addPage() {
    writePageFooter();
    doc.addPage();
    pageNum++;
    y = MARGIN_Y;
  }

  function ensureSpace(needed: number) {
    if (y + needed > MAX_Y) addPage();
  }

  function writePageFooter() {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_LIGHT);
    doc.text(
      `Flowen Speech Technology Ltd  ·  flowen.digital`,
      MARGIN_X,
      PAGE_H - 8,
    );
    doc.text(
      String(pageNum),
      PAGE_W - MARGIN_X,
      PAGE_H - 8,
      { align: 'right' },
    );
  }

  // ── Cover: title block ─────────────────────────────────────────────────────
  // Brand rule
  doc.setFillColor(BRAND_GREEN);
  doc.rect(MARGIN_X, y, CONTENT_W, 1.2, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(TEXT_DARK);
  const titleLines = doc.splitTextToSize(h1Text, CONTENT_W) as string[];
  doc.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 9 + 6;

  // Subtitle: date from .doc-meta if present
  const metaEl = document.querySelector('.doc-meta');
  if (metaEl?.textContent?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_LIGHT);
    doc.text(metaEl.textContent.trim(), MARGIN_X, y);
    y += 7;
  }

  // Light rule below title block
  doc.setFillColor(RULE_COLOR);
  doc.rect(MARGIN_X, y, CONTENT_W, 0.5, 'F');
  y += 8;

  // ── Body content ──────────────────────────────────────────────────────────
  for (const el of nodes) {
    const raw = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (!raw) continue;

    const tag = el.tagName;

    switch (tag) {
      case 'H1': // already handled above
        break;

      case 'H2': {
        ensureSpace(14);
        y += 4; // paragraph gap before heading
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(TEXT_DARK);
        const lines = doc.splitTextToSize(raw, CONTENT_W) as string[];
        doc.text(lines, MARGIN_X, y);
        y += lines.length * 6 + 2;
        // thin rule under h2
        doc.setFillColor('#E5E7EB');
        doc.rect(MARGIN_X, y, CONTENT_W, 0.3, 'F');
        y += 4;
        break;
      }

      case 'H3':
      case 'H4': {
        ensureSpace(10);
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(TEXT_MID);
        const lines = doc.splitTextToSize(raw, CONTENT_W) as string[];
        doc.text(lines, MARGIN_X, y);
        y += lines.length * 5.5 + 2;
        break;
      }

      case 'LI': {
        const indent = 24;
        const w = CONTENT_W - 6;
        const lines = doc.splitTextToSize(raw, w) as string[];
        ensureSpace(lines.length * 5 + 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(TEXT_MID);
        // Bullet dot
        doc.setFillColor(BRAND_GREEN);
        doc.circle(MARGIN_X + 2, y - 1.5, 0.9, 'F');
        doc.text(lines, MARGIN_X + 6, y);
        y += lines.length * 5 + 1.5;
        break;
      }

      case 'TH':
      case 'TD': {
        const lines = doc.splitTextToSize(raw, CONTENT_W) as string[];
        ensureSpace(lines.length * 5 + 1);
        doc.setFont(tag === 'TH' ? 'helvetica' : 'helvetica', tag === 'TH' ? 'bold' : 'normal');
        doc.setFontSize(9);
        doc.setTextColor(TEXT_MID);
        doc.text(lines, MARGIN_X + 2, y);
        y += lines.length * 5;
        break;
      }

      case 'BLOCKQUOTE': {
        const lines = doc.splitTextToSize(raw, CONTENT_W - 6) as string[];
        ensureSpace(lines.length * 5 + 4);
        doc.setFillColor('#F0FDF4');
        doc.rect(MARGIN_X, y - 3, CONTENT_W, lines.length * 5 + 4, 'F');
        doc.setFillColor(BRAND_GREEN);
        doc.rect(MARGIN_X, y - 3, 1.5, lines.length * 5 + 4, 'F');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(TEXT_MID);
        doc.text(lines, MARGIN_X + 6, y);
        y += lines.length * 5 + 6;
        break;
      }

      default: { // P and everything else
        const lines = doc.splitTextToSize(raw, CONTENT_W) as string[];
        ensureSpace(lines.length * 5 + 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(TEXT_MID);
        doc.text(lines, MARGIN_X, y);
        y += lines.length * 5 + 3;
        break;
      }
    }
  }

  writePageFooter();

  const filename = h1Text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`${filename}.pdf`);
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
