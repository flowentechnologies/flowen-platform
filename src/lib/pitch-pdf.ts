/**
 * Flowen Investor Pitch Deck — PDF generator
 *
 * Generates a 13-slide A4-landscape PDF using pdfkit.
 * All content is hard-coded here so the document is self-contained
 * and renderable without a browser / headless Chrome.
 *
 * Colour tokens mirror deck.html:
 *   BG_NAVY  #0C0E1A   CARD     #14172E
 *   AMBER    #E2703A   TEAL     #2FBBA3
 *   VIOLET   #8B5CF6   PAPER    #F5F3EE
 *   LAVENDER #A6A3BE   GOLD     #D9A441
 */

import PDFDocument from 'pdfkit';

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:      '#0C0E1A',
  card:    '#14172E',
  amber:   '#E2703A',
  gold:    '#D9A441',
  teal:    '#2FBBA3',
  violet:  '#8B5CF6',
  paper:   '#F5F3EE',
  lav:     '#A6A3BE',
  lavdim:  '#6E6C88',
  white:   '#FFFFFF',
  rose:    '#F87171',
} as const;

// ── Page dimensions (A4 landscape, pt) ──────────────────────────────────────
const W = 841.89;
const H = 595.28;

const MARGIN = 44;
const CONTENT_W = W - MARGIN * 2;

// ── Slide data ───────────────────────────────────────────────────────────────
interface Slide {
  num: string;
  title: string;
  body: string;
  stat?: string;
  statColor?: string;
  bullets?: Array<{ text: string; color: string }>;
  grid?: Array<{ label: string; value: string; color: string }>;
  accentColor?: string;   // border / heading accent (default: teal)
}

const SLIDES: Slide[] = [
  {
    num: '01',
    title: '80 Million people stammer. We built FLOWEN — a deep-tech data processing engine that turns disfluent speech into the world\'s most valuable clinical dataset.',
    body: 'FLOWEN = Fluency & Language Optimization With Empathic Neurofeedback. Proprietary phoneme-level disfluent ASR pipeline. Not a health app. A data processing company.',
    bullets: [
      { text: 'LIVED EXPERIENCE FOUNDER', color: C.amber },
      { text: 'DEEP TECH · DATA PROCESSING ENGINE', color: C.violet },
      { text: 'PROPRIETARY DISFLUENT ASR PIPELINE', color: C.teal },
      { text: 'NOT JUST A HEALTH APP', color: C.lav },
    ],
    accentColor: C.amber,
  },
  {
    num: '02',
    title: '18-Month NHS Waits. £200/Hour Therapy. 92% Dropout. Zero Daily Tools.',
    body: '80 million people globally stutter. NHS SALT queues are critically oversubscribed. Standard AI (Google, Siri, Whisper) treats disfluency as noise and times out — it was never designed for it. No effective daily practice tool exists.',
    grid: [
      { label: 'NHS SALT wait', value: '18 months', color: C.rose },
      { label: 'Dropout rate', value: '92%', color: C.amber },
      { label: 'People globally', value: '80M+', color: C.violet },
      { label: 'Private therapy cost', value: '£200/hr', color: C.rose },
    ],
    accentColor: C.rose,
  },
  {
    num: '03',
    title: 'Deep Tech & Data Processing: Phoneme-Level Disfluency Pipeline',
    body: 'This is not a health app with an AI wrapper. Flowen is a data processing company built on a proprietary phoneme-level pipeline that processes speech blocks as structured training signals. Google and Apple ASR discard disfluencies — our model is trained on them. That inversion is the moat.',
    stat: '< 150ms',
    statColor: C.violet,
    bullets: [
      { text: 'Phoneme-level block detection (not word-level like standard ASR)', color: C.violet },
      { text: '100k+ proprietary disfluent clips — growing with each session', color: C.violet },
      { text: 'No public dataset exists for this — we built it from scratch', color: C.lav },
      { text: 'Exit precedent: Nuance acquired $19.7bn — for the DATA, not the product', color: C.amber },
    ],
    accentColor: C.violet,
  },
  {
    num: '04',
    title: 'Product & Compliance: 3D Viseme Guide. NHS #WaitlistHero.',
    body: 'Continuous mouth-shape animation, breathing biofeedback, and real-time block coaching. Built to NHS clinical safety standards from day one. Full compliance stack aligned before commercialisation.',
    bullets: [
      { text: '✓  DTAC Aligned', color: C.teal },
      { text: '✓  DCB0129 Clinical Safety', color: C.teal },
      { text: '✓  UK GDPR', color: C.teal },
      { text: '✓  WCAG 2.1 AA', color: C.teal },
    ],
    accentColor: C.teal,
  },
  {
    num: '05',
    title: 'Methodology: 7-Stage Practice Ladder — From Block to Flow',
    body: 'Combines Fluency Shaping (diaphragmatic onset) & Stammering Modification (pull-outs) into continuous visual biofeedback loops. Every session generates phoneme-level block data that feeds back into the ASR training pipeline.',
    bullets: [
      { text: 'Stage 01 — Single Words: Diaphragmatic onset, gentle vocal cord vibration', color: C.teal },
      { text: 'Stage 02 — Phrases & Chunks: Continuous phonation across word boundaries', color: C.teal },
      { text: 'Stage 03 — Sentences: Light articulatory contacts, rate control', color: C.teal },
      { text: 'Stage 04 — Paragraphs: Laryngeal tension monitoring, preparatory sets', color: C.teal },
      { text: 'Stage 05 — Live Conversation: Real-world transfer, desensitisation, AI dialogue', color: C.amber },
    ],
    accentColor: C.teal,
  },
  {
    num: '06',
    title: 'The Data Flywheel: Each Session = New Training Data',
    body: 'Every user practice session generates annotated phoneme-level disfluency data. This feeds directly back into ASR fine-tuning. As users grow, the model improves — creating a compounding data moat no competitor can replicate without years of clinical partnerships.',
    bullets: [
      { text: 'User session → phoneme block captured as structured data', color: C.violet },
      { text: 'Block data → ASR fine-tuning pipeline', color: C.violet },
      { text: 'Better model → better product → more users → more data', color: C.teal },
      { text: 'Compounding advantage irreplicable without clinical access', color: C.amber },
    ],
    accentColor: C.violet,
  },
  {
    num: '07',
    title: 'Two-Brand Global Market: £8.84bn Combined TAM',
    body: '20% is what we capture and control. The remaining 80% of total market stays available for further expansion — this is not a ceiling, it is the beach-head thesis.',
    grid: [
      { label: 'Combined TAM', value: '£8.84bn', color: C.amber },
      { label: 'SAM (addressable)', value: '£892m', color: C.teal },
      { label: 'SOM Year 3', value: '£37m', color: C.teal },
      { label: 'Mature 20% target', value: '£1.77bn', color: C.amber },
    ],
    bullets: [
      { text: 'Flowen — Tier 1/2: UK · EU · US · AU · Japan · ME  →  TAM £7.04bn', color: C.teal },
      { text: 'Vocali — Tier 3/4: India · LatAm · Africa · SE Asia  →  TAM £1.8bn', color: C.violet },
    ],
    accentColor: C.amber,
  },
  {
    num: '08',
    title: 'Distribution & Organic Traction: 10,000 Year 1 Sign-Ups. Zero Paid CAC.',
    body: 'Through organic personal relationships with PWS communities, stammering support groups, SLTs, and clinicians — 10,000 sign-ups are achievable in Year 1 without any paid acquisition. Validates demand before marketing spend begins.',
    stat: '10K',
    statColor: C.teal,
    bullets: [
      { text: "Founder's direct PWS community contacts (UK + global)", color: C.amber },
      { text: 'SLT clinician network — free SLP portal creates clinical pull', color: C.teal },
      { text: 'NHS ICB block pledges — waiting-list relief angle', color: C.lav },
      { text: 'Word-of-mouth: stuttering community is tight-knit with high advocacy density', color: C.lav },
    ],
    accentColor: C.teal,
  },
  {
    num: '09',
    title: 'Unit Economics & Exit: Deep Tech Commands 30×+ Multiples',
    body: 'The valuation premium comes from the proprietary dataset and pipeline. Microsoft paid $19.7bn for Nuance (~35× ARR). Flowen\'s acquirers are buying the data moat, not a subscription business.',
    stat: '30–40×',
    statColor: C.amber,
    grid: [
      { label: 'Flowen MRR target', value: '£19.96/mo', color: C.teal },
      { label: 'Vocali MRR', value: '£1–3/mo', color: C.violet },
      { label: 'Gross margin (Flowen)', value: '85–91%', color: C.teal },
      { label: 'Savings vs private therapy', value: '95%', color: C.teal },
    ],
    bullets: [
      { text: 'Nuance → Microsoft: $19.7bn ~35× ARR (data pipeline acquisition)', color: C.amber },
      { text: 'Speechify Series A: $175m ~35× ARR', color: C.gold },
      { text: 'Target exit multiple: 30–40× ARR from strategic acquirer', color: C.amber },
    ],
    accentColor: C.amber,
  },
  {
    num: '10',
    title: 'Vocali — The Global Access Play',
    body: 'Vocali is a stripped-down spinoff of Flowen built for high-population, low-income markets. Low ARPU, massive user volume — more active users than Flowen even at lower revenue per user. Distribution via carrier billing, NGOs, school systems.',
    stat: '65M+',
    statColor: C.violet,
    grid: [
      { label: 'India', value: '28M+ PWS', color: C.violet },
      { label: 'Sub-Saharan Africa', value: '12M+ PWS', color: C.violet },
      { label: 'LatAm + SE Asia', value: '25M+ PWS', color: C.violet },
      { label: '20% target =', value: '13M+ users', color: C.amber },
    ],
    accentColor: C.violet,
  },
  {
    num: '11',
    title: 'Execution Roadmap: 5-Year Path — UK Anchor → Global → Vocali Scale',
    body: 'Compressed execution: NHS beachhead → Tier 1 international → Vocali launch in Tier 3/4 → 20% UK + global penetration.',
    bullets: [
      { text: 'FY1 (2026): £120k ARR · 10K users · NHS pilot (1 ICB) · organic only', color: C.teal },
      { text: 'FY2 (2027): £480k ARR · 200–400 users · 3 ICBs + SLP portal launch', color: C.teal },
      { text: 'FY3 (2028): £1.5m ARR · 1,000+ users · 5 ICBs + EU/US seed partnerships', color: C.teal },
      { text: 'FY4 (2029): £4.5m ARR · 5,000+ users · Tier 1 intl + Vocali beta', color: C.amber },
      { text: 'FY5 (2030): £12m ARR · 20,000+ users · 20% UK + global scale + Vocali', color: C.amber },
    ],
    accentColor: C.teal,
  },
  {
    num: '12',
    title: 'Founder Obsession: Lived Experience. Relentless Shipping. Deep Tech from Day 1.',
    body: 'Stuttering onset at 18 months. 30+ years of lived experience driving product depth no outside team can replicate. Built the proprietary ASR pipeline, the clinical safety framework, and the founding member model independently — shipping continuously.',
    bullets: [
      { text: 'Founder-market fit: unmatched clinical intuition and community trust', color: C.amber },
      { text: 'Deep tech architect: built the ASR pipeline and data infrastructure from scratch', color: C.violet },
      { text: 'PWS community: 30+ years of personal contacts = organic distribution', color: C.teal },
      { text: 'Clinician relationships: SLT network = direct institutional pull', color: C.teal },
    ],
    accentColor: C.amber,
  },
  {
    num: '13',
    title: 'The Partner Ask: £250k Pre-Seed · SEIS Eligible · 30× Exit Target',
    body: 'Seeking capital with health-tech, deep-tech, and global distribution density. Use of funds: clinical validation 35% · ASR pipeline & data infrastructure 30% · regulatory UKCA/CE 15% · market access 12% · operations 8%.',
    bullets: [
      { text: 'SEIS eligible: 50% income tax relief + CGT exemption for qualifying investors', color: C.teal },
      { text: 'Exit thesis: proprietary dataset + pipeline at 30–40× ARR from strategic acquirer', color: C.amber },
      { text: 'Acquirer types: NHS digital supplier · speech tech group · global mental health platform', color: C.lav },
      { text: 'Flowen + Vocali = complete global speech platform · Vocali upside optionality', color: C.violet },
    ],
    grid: [
      { label: 'Raise', value: '£250k', color: C.amber },
      { label: 'Combined TAM', value: '£8.84bn', color: C.teal },
      { label: 'Exit target', value: '30–40× ARR', color: C.amber },
      { label: 'Tax relief', value: '50% SEIS', color: C.teal },
    ],
    accentColor: C.teal,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function fillBg(doc: PDFKit.PDFDocument, color: string) {
  const [r, g, b] = hexToRgb(color);
  doc.rect(0, 0, W, H).fill([r, g, b]);
}

function fillRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: string, radius = 0) {
  const [r, g, b] = hexToRgb(color);
  doc.roundedRect(x, y, w, h, radius).fill([r, g, b]);
}

function strokeRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, color: string, lw = 1, radius = 4) {
  const [r, g, b] = hexToRgb(color);
  doc.roundedRect(x, y, w, h, radius).lineWidth(lw).strokeColor([r, g, b]).stroke();
}

function text(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  options: {
    color?: string;
    font?: string;
    size?: number;
    width?: number;
    align?: 'left' | 'center' | 'right';
    lineGap?: number;
  } = {},
) {
  const { color = C.paper, font = 'Helvetica', size = 10, width, align = 'left', lineGap = 2 } = options;
  const [r, g, b] = hexToRgb(color);
  doc.font(font).fontSize(size).fillColor([r, g, b]).text(str, x, y, {
    ...(width !== undefined ? { width } : {}),
    align,
    lineGap,
  });
}

// ── Logo wave (simplified) ───────────────────────────────────────────────────
function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, scale = 1) {
  // Simple double-wave mark using bezier curves
  const s = scale;
  [[C.amber, 0], [C.teal, 6 * s]].forEach(([color, dy]) => {
    const [r, g, b] = hexToRgb(color as string);
    doc.moveTo(x, y + (dy as number));
    doc.bezierCurveTo(x + 10 * s, y + (dy as number) - 5 * s, x + 18 * s, y + (dy as number) + 8 * s, x + 28 * s, y + (dy as number) - 2 * s);
    doc.bezierCurveTo(x + 36 * s, y + (dy as number) - 10 * s, x + 44 * s, y + (dy as number) + 8 * s, x + 52 * s, y + (dy as number));
    doc.lineWidth(2.5 * s).strokeColor([r, g, b]).stroke();
  });
}

// ── Slide header ─────────────────────────────────────────────────────────────
function slideHeader(doc: PDFKit.PDFDocument, slide: Slide) {
  // Slide number bar
  const accent = slide.accentColor ?? C.teal;
  fillRect(doc, 0, 0, 5, H, accent);

  // Logo
  drawLogo(doc, MARGIN, 22, 0.9);

  // Slide number
  text(doc, `SLIDE ${slide.num}`, MARGIN + 60, 22, { color: accent, font: 'Helvetica-Bold', size: 8 });
  text(doc, '// FLOWEN INVESTOR DECK // CONFIDENTIAL', MARGIN + 60, 32, { color: C.lavdim, font: 'Helvetica', size: 7 });

  // Divider
  const [r, g, b] = hexToRgb(accent);
  doc.moveTo(MARGIN, 48).lineTo(W - MARGIN, 48).lineWidth(0.5).strokeColor([r, g, b]).stroke();
}

// ── Stat badge ───────────────────────────────────────────────────────────────
function statBadge(doc: PDFKit.PDFDocument, value: string, color: string, x: number, y: number) {
  const [r, g, b] = hexToRgb(color);
  fillRect(doc, x, y, 180, 52, C.card, 8);
  strokeRect(doc, x, y, 180, 52, color, 1, 8);
  doc.font('Helvetica-Bold').fontSize(30).fillColor([r, g, b]).text(value, x, y + 11, { width: 180, align: 'center' });
}

// ── Grid cells ───────────────────────────────────────────────────────────────
function drawGrid(doc: PDFKit.PDFDocument, items: Array<{ label: string; value: string; color: string }>, x: number, y: number, totalW: number) {
  const cols = Math.min(items.length, 4);
  const cellW = (totalW - (cols - 1) * 8) / cols;
  items.slice(0, 4).forEach((item, i) => {
    const cx = x + i * (cellW + 8);
    fillRect(doc, cx, y, cellW, 48, C.card, 6);
    strokeRect(doc, cx, y, cellW, 48, item.color, 0.75, 6);
    const [r, g, b] = hexToRgb(item.color);
    doc.font('Helvetica-Bold').fontSize(16).fillColor([r, g, b]).text(item.value, cx, y + 8, { width: cellW, align: 'center' });
    const [lr, lg, lb] = hexToRgb(C.lavdim);
    doc.font('Helvetica').fontSize(7.5).fillColor([lr, lg, lb]).text(item.label.toUpperCase(), cx, y + 31, { width: cellW, align: 'center' });
  });
}

// ── Bullets ───────────────────────────────────────────────────────────────────
function drawBullets(
  doc: PDFKit.PDFDocument,
  bullets: Array<{ text: string; color: string }>,
  x: number,
  y: number,
  width: number,
): number {
  let cy = y;
  bullets.forEach((b) => {
    const [r, g, bv] = hexToRgb(b.color);
    // Dot
    doc.circle(x + 3, cy + 5, 2.5).fill([r, g, bv]);
    doc.font('Helvetica').fontSize(9).fillColor([r, g, bv]).text(b.text, x + 12, cy, { width: width - 12, lineGap: 1 });
    cy += doc.heightOfString(b.text, { width: width - 12 }) + 7;
  });
  return cy;
}

// ── Footer ────────────────────────────────────────────────────────────────────
function slideFooter(doc: PDFKit.PDFDocument, slideNum: number, total: number) {
  const [r, g, b] = hexToRgb(C.lavdim);
  const footY = H - 20;
  doc.font('Helvetica').fontSize(7).fillColor([r, g, b]).text('FLOWEN TECHNOLOGIES LTD · LONDON, UK · FLOWEN + VOCALI DUAL BRAND', MARGIN, footY, { align: 'left', width: CONTENT_W - 60 });
  doc.font('Helvetica').fontSize(7).fillColor([r, g, b]).text(`${slideNum} / ${total}`, MARGIN, footY, { align: 'right', width: CONTENT_W });
}

// ── Main render function ──────────────────────────────────────────────────────
function renderSlide(doc: PDFKit.PDFDocument, slide: Slide, slideNum: number, total: number) {
  fillBg(doc, C.bg);
  slideHeader(doc, slide);

  let y = 58;
  const accent = slide.accentColor ?? C.teal;

  // Title
  const titleSize = slide.title.length > 120 ? 16 : slide.title.length > 80 ? 18 : 20;
  text(doc, slide.title, MARGIN, y, { color: C.paper, font: 'Helvetica-Bold', size: titleSize, width: CONTENT_W, lineGap: 3 });
  y += doc.heightOfString(slide.title, { width: CONTENT_W, lineGap: 3 }) + 10;

  // Accent line under title
  const [ar, ag, ab] = hexToRgb(accent);
  doc.moveTo(MARGIN, y).lineTo(MARGIN + 60, y).lineWidth(2).strokeColor([ar, ag, ab]).stroke();
  y += 10;

  // Stat (if any) — positioned right-aligned
  if (slide.stat) {
    statBadge(doc, slide.stat, slide.statColor ?? accent, W - MARGIN - 180, 58);
    // Reduce body width to avoid overlap
  }

  const bodyW = slide.stat ? CONTENT_W - 200 : CONTENT_W;

  // Body
  text(doc, slide.body, MARGIN, y, { color: C.lav, font: 'Helvetica', size: 9.5, width: bodyW, lineGap: 2 });
  y += doc.heightOfString(slide.body, { width: bodyW, lineGap: 2 }) + 14;

  // Grid
  if (slide.grid && slide.grid.length > 0) {
    drawGrid(doc, slide.grid, MARGIN, y, CONTENT_W);
    y += 62;
  }

  // Bullets
  if (slide.bullets && slide.bullets.length > 0) {
    drawBullets(doc, slide.bullets, MARGIN, y, CONTENT_W);
  }

  slideFooter(doc, slideNum, total);
}

// ── Cover page ────────────────────────────────────────────────────────────────
function renderCover(doc: PDFKit.PDFDocument) {
  fillBg(doc, C.bg);

  // Side accent bar
  fillRect(doc, 0, 0, 5, H, C.amber);

  // Logo large
  drawLogo(doc, W / 2 - 28, 100, 2.2);

  // Tagline
  text(doc, 'FLOWEN', W / 2 - 60, 160, { color: C.paper, font: 'Helvetica-Bold', size: 40, width: 120, align: 'center' });
  text(doc, 'Fluency & Language Optimization With Empathic Neurofeedback', MARGIN, 208, { color: C.lav, font: 'Helvetica', size: 10, width: CONTENT_W, align: 'center' });

  // Divider
  const [tr, tg, tb] = hexToRgb(C.teal);
  doc.moveTo(W / 2 - 100, 232).lineTo(W / 2 + 100, 232).lineWidth(1).strokeColor([tr, tg, tb]).stroke();

  // Subtitles
  text(doc, 'DEEP TECH · DATA PROCESSING · DUAL-BRAND GLOBAL SPEECH PLATFORM', MARGIN, 244, { color: C.amber, font: 'Helvetica-Bold', size: 8.5, width: CONTENT_W, align: 'center' });
  text(doc, 'Proprietary Disfluent ASR Pipeline · Flowen (Tier 1/2) + Vocali (Tier 3/4) · £8.84bn Combined TAM', MARGIN, 260, { color: C.lavdim, font: 'Helvetica', size: 8, width: CONTENT_W, align: 'center' });

  // Key stats row
  const stats = [
    { v: '80M+', l: 'Global PWS' },
    { v: '£8.84bn', l: 'Combined TAM' },
    { v: '30–40×', l: 'Exit Target' },
    { v: '£250k', l: 'Pre-Seed SEIS' },
  ];
  const statW = 140;
  const statStart = W / 2 - (stats.length * statW) / 2;
  stats.forEach((s, i) => {
    const sx = statStart + i * statW;
    fillRect(doc, sx, 295, 128, 54, C.card, 8);
    strokeRect(doc, sx, 295, 128, 54, i % 2 === 0 ? C.amber : C.teal, 1, 8);
    const [r, g, b] = hexToRgb(i % 2 === 0 ? C.amber : C.teal);
    doc.font('Helvetica-Bold').fontSize(22).fillColor([r, g, b]).text(s.v, sx, 306, { width: 128, align: 'center' });
    const [lr, lg, lb] = hexToRgb(C.lavdim);
    doc.font('Helvetica').fontSize(7.5).fillColor([lr, lg, lb]).text(s.l.toUpperCase(), sx, 330, { width: 128, align: 'center' });
  });

  // Two-brand row
  const brandY = 374;
  const bW = (CONTENT_W - 12) / 2;
  [[C.teal, 'FLOWEN', 'Tier 1/2: UK · EU · US · AU · Japan · Middle East', 'Premium · £20+/mo · 85%+ gross margin'],
   [C.violet, 'VOCALI', 'Tier 3/4: India · LatAm · Africa · SE Asia', '65M+ addressable PWS · £1–3/mo · volume play']].forEach(([color, name, desc, sub], i) => {
    const bx = MARGIN + i * (bW + 12);
    fillRect(doc, bx, brandY, bW, 60, C.card, 8);
    strokeRect(doc, bx, brandY, bW, 60, color as string, 1, 8);
    const [r, g, b] = hexToRgb(color as string);
    doc.font('Helvetica-Bold').fontSize(12).fillColor([r, g, b]).text(name as string, bx + 10, brandY + 8);
    const [lr, lg, lb] = hexToRgb(C.lav);
    doc.font('Helvetica').fontSize(8.5).fillColor([lr, lg, lb]).text(desc as string, bx + 10, brandY + 25);
    doc.font('Helvetica').fontSize(7.5).fillColor([lr, lg, lb]).text(sub as string, bx + 10, brandY + 39);
  });

  // Footer
  const [lr, lg, lb] = hexToRgb(C.lavdim);
  doc.font('Helvetica').fontSize(7).fillColor([lr, lg, lb])
    .text('CONFIDENTIAL — NOT FOR DISTRIBUTION · flowen.digital · flowenspeech@outlook.com', MARGIN, H - 22, { width: CONTENT_W, align: 'center' });
}

// ── Public API ────────────────────────────────────────────────────────────────
export function buildPitchPDF(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [W, H],   // A4 landscape
        margin: 0,
        info: {
          Title:   'Flowen — Investor Pitch Deck',
          Author:  'Flowen Technologies Ltd',
          Subject: 'Pre-Seed Investment Opportunity',
          Keywords: 'Flowen Vocali ASR speech stammer deep tech SEIS',
          Creator: 'Flowen Technologies',
        },
        compress: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Cover
      renderCover(doc);

      // 13 content slides
      SLIDES.forEach((slide, i) => {
        doc.addPage({ size: [W, H], margin: 0 });
        renderSlide(doc, slide, i + 1, SLIDES.length);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
