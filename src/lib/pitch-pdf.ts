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
import { patchPdfkitStandardFonts } from './pdfkit-fonts-patch';

patchPdfkitStandardFonts();

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
    title: '80 Million people stammer. We built FLOWEN — a real-time acoustic biofeedback engine purpose-built for disfluent speech.',
    body: 'FLOWEN = Fluency & Language Optimization With Empathic Neurofeedback. A proprietary, sub-80ms real-time acoustic pipeline, built in-house — not a wrapper around someone else\'s speech AI.',
    bullets: [
      { text: 'LIVED EXPERIENCE FOUNDER', color: C.amber },
      { text: 'DEEP TECH · REAL-TIME ACOUSTIC ENGINE', color: C.violet },
      { text: 'PROPRIETARY, SUB-80MS PIPELINE', color: C.teal },
      { text: 'BUILT FOR DISFLUENT SPEECH, NOT FLUENT SPEECH', color: C.lav },
    ],
    accentColor: C.amber,
  },
  {
    num: '02',
    title: 'Patchy NHS Coverage. £200/Hour Private Therapy. Zero Daily Tools.',
    body: '80 million people globally stutter [1]. NHS adult stammering coverage varies widely by area — reported waits range from a few weeks to several months, and some areas have no dedicated adult service at all [2]. Standard AI (Google, Siri, Whisper) is trained on fluent speech and was never designed to characterise disfluency. No effective daily practice tool exists.',
    grid: [
      { label: 'NHS coverage', value: 'Patchy', color: C.rose },
      { label: 'Private therapy', value: '£200/hr', color: C.amber },
      { label: 'People globally', value: '80M+', color: C.violet },
      { label: 'Daily practice tools', value: 'None', color: C.rose },
    ],
    accentColor: C.rose,
  },
  {
    num: '03',
    title: 'Deep Tech: A Real-Time Acoustic Pipeline Purpose-Built for Disfluent Speech',
    body: 'This isn\'t a health app wrapped around someone else\'s speech AI. Flowen\'s core is a proprietary, rule-based acoustic engine, built from scratch, that detects blocks, prolongations, and repetitions directly from the raw audio signal in real time. General-purpose ASR (Google, Apple, Whisper) is trained on fluent speech and isn\'t designed to characterise disfluency — Flowen doesn\'t rely on it for detection.',
    stat: '<80ms',
    statColor: C.violet,
    bullets: [
      { text: 'Acoustic-signal detection (amplitude, pitch, voice-tension) — not word-level transcription', color: C.violet },
      { text: 'Sub-80ms audio pipeline; block/prolongation/repetition detection resolves within 300ms end-to-end', color: C.violet },
      { text: 'Built entirely in-house — no third-party disfluency-detection model exists to depend on', color: C.lav },
      { text: 'Every session\'s outcome data compounds into clinical evidence as usage grows', color: C.amber },
    ],
    accentColor: C.violet,
  },
  {
    num: '04',
    title: 'Product & Compliance: 3D Viseme Guide. NHS #WaitlistHero.',
    body: 'Continuous mouth-shape animation, breathing biofeedback, and real-time block coaching — with a formal hazard log already tracking 8 identified risks (6 mitigated) [3].',
    bullets: [
      { text: 'DTAC — in progress (8/10 items)', color: C.amber },
      { text: 'DCB0129 — in progress (7/8 items)', color: C.amber },
      { text: 'UK GDPR — designed in from day one', color: C.teal },
      { text: 'WCAG 2.1 AA — 0 automated violations; audit in progress', color: C.amber },
    ],
    accentColor: C.teal,
  },
  {
    num: '05',
    title: 'Methodology: 7-Stage Practice Ladder — From Block to Flow',
    body: 'Combines Fluency Shaping (diaphragmatic onset) & Stammering Modification (pull-outs) into continuous visual biofeedback loops. Every session logs structured block/prolongation/repetition event data, building a growing real-world evidence base.',
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
    title: 'The Real Flywheel: Every Session Strengthens the Evidence Base',
    body: 'Every practice session logs structured, anonymised outcome data — disfluency counts, fluency trends, technique adherence. That evidence compounds: it strengthens the clinical case NHS commissioners need to see, deepens SLT trust, and sharpens the product roadmap. This is a clinical-evidence and distribution flywheel, not a model-training one — Flowen\'s detection engine is hand-built and rule-based, not a model that needs data to improve.',
    bullets: [
      { text: 'Session -> structured outcome data (events, trends, adherence) captured automatically', color: C.violet },
      { text: 'Outcome data -> stronger clinical evidence for NHS/ICB commissioning conversations', color: C.violet },
      { text: 'Better evidence -> more clinician referrals -> more users -> more evidence', color: C.teal },
      { text: 'Compounding advantage: 30+ years of founder community trust + a growing outcomes record', color: C.amber },
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
      { text: 'Flowen — Tier 1/2: UK · EU · US · AU · Japan · ME  ->  TAM £7.04bn', color: C.teal },
      { text: 'Vocali — Tier 3/4: India · LatAm · Africa · SE Asia  ->  TAM £1.8bn', color: C.violet },
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
      { text: 'NHS ICB conversations — waiting-list relief angle (0 formal contacts to date, see Slide 14)', color: C.lav },
      { text: 'Word-of-mouth: stuttering community is tight-knit with high advocacy density', color: C.lav },
    ],
    accentColor: C.teal,
  },
  {
    num: '09',
    title: 'Unit Economics & Exit: Deep Tech Commands 30×+ Multiples',
    body: 'Speech-tech M&A has commanded a valuation premium: Microsoft paid $19.7bn for Nuance (~35× ARR), largely for clinical-workflow integration and decades of enterprise ASR data — a sector comp, not a claim that Flowen holds an equivalent dataset. Flowen\'s premium case rests on a different asset: a proprietary, purpose-built acoustic detection engine and an NHS-compliant clinical position competitors would need years to replicate.',
    stat: '30–40×',
    statColor: C.amber,
    grid: [
      { label: 'Flowen MRR target', value: '£19.96/mo', color: C.teal },
      { label: 'Vocali MRR', value: '£1–3/mo', color: C.violet },
      { label: 'Gross margin (Flowen)', value: '85–91%', color: C.teal },
      { label: 'Savings vs private therapy', value: '95%', color: C.teal },
    ],
    bullets: [
      { text: 'Nuance -> Microsoft: $19.7bn ~35× ARR [4] (sector comp: clinical ASR + enterprise data)', color: C.amber },
      { text: 'ElevenLabs: $500m raised at $11bn valuation, Feb 2026 [5]', color: C.gold },
      { text: 'Target exit multiple: 30–40× ARR, on the strength of the acoustic pipeline + clinical position', color: C.amber },
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
    title: 'Execution Roadmap: 5-Year Path — UK Anchor -> Global -> Vocali Scale',
    body: 'Compressed execution: NHS beachhead -> Tier 1 international -> Vocali launch in Tier 3/4 -> 20% UK + global penetration.',
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
    body: 'Stuttering onset at 18 months. 30+ years of lived experience driving product depth no outside team can replicate. Built the proprietary acoustic biofeedback pipeline, the clinical safety framework, and the founding member model independently — 452 commits in 6 weeks, solo [6], shipping continuously.',
    bullets: [
      { text: 'Founder-market fit: unmatched clinical intuition and community trust', color: C.amber },
      { text: 'Deep tech architect: built the acoustic biofeedback pipeline and clinical data infrastructure from scratch', color: C.violet },
      { text: 'PWS community: 30+ years of personal contacts = organic distribution', color: C.teal },
      { text: 'Clinician relationships: SLT network = direct institutional pull', color: C.teal },
    ],
    accentColor: C.amber,
  },
  {
    num: '13',
    title: 'The Partner Ask: £350k Pre-Seed · SEIS Eligible · 30× Exit Target',
    body: 'Seeking capital with health-tech, deep-tech, and global distribution density. Use of funds: clinical validation 35% · acoustic pipeline & clinical data infrastructure 30% · regulatory UKCA/CE 15% · market access 12% · operations 8%.',
    bullets: [
      { text: 'SEIS eligible: 50% income tax relief + CGT exemption for qualifying investors', color: C.teal },
      { text: 'Exit thesis: proprietary acoustic pipeline + clinical compliance position at 30–40× ARR from strategic acquirer', color: C.amber },
      { text: 'Acquirer types: NHS digital supplier · speech tech group · global mental health platform', color: C.lav },
      { text: 'Flowen + Vocali = complete global speech platform · Vocali upside optionality', color: C.violet },
    ],
    grid: [
      { label: 'Raise', value: '£350k', color: C.amber },
      { label: 'Combined TAM', value: '£8.84bn', color: C.teal },
      { label: 'Exit target', value: '30–40× ARR', color: C.amber },
      { label: 'Tax relief', value: '50% SEIS', color: C.teal },
    ],
    accentColor: C.teal,
  },
  {
    num: '14',
    title: 'Traction So Far: Early, Real, Honestly Reported',
    body: 'Pre-launch, founder-funded, six weeks into building. These are the real numbers today — not a projection, and not the Year 1 target on Slide 8.',
    stat: '26',
    statColor: C.teal,
    grid: [
      { label: 'Signups', value: '10', color: C.teal },
      { label: 'Waitlist', value: '9', color: C.teal },
      { label: 'Sessions logged', value: '26', color: C.teal },
      { label: 'Investor / grant convos', value: '3 / 1', color: C.amber },
    ],
    bullets: [
      { text: 'NHS contacts to date: 0 — an honest, real gap, not yet an achievement', color: C.rose },
    ],
    accentColor: C.teal,
  },
  {
    num: '15',
    title: 'Competitive Landscape: No One Else Owns Real-Time + Clinical Safety',
    body: 'Stammering-specific apps exist. None combine real-time on-device acoustic biofeedback with an NHS clinical-safety-first architecture (DCB0129/DTAC) built in from day one.',
    bullets: [
      { text: 'Stamurai — 50k+ users, 180 countries [7]. Exercise library + community, not real-time acoustic detection.', color: C.lav },
      { text: 'SpeechAgain (Berlin) — cloud AI speech analysis; not positioned for NHS clinical-safety procurement.', color: C.lav },
      { text: 'Iyaso (India, 2023) — early-stage, communication-skills focused.', color: C.lav },
      { text: 'DAF Pro — delayed auditory feedback only; a single fixed technique, no adaptive detection.', color: C.lav },
    ],
    accentColor: C.amber,
  },
  {
    num: '16',
    title: 'Built · De-Risked · Still Need',
    body: 'Six weeks solo. A real product, not a deck.',
    bullets: [
      { text: 'BUILT: full acoustic biofeedback pipeline (pitch/tension/onset), 3D viseme avatar, 5-stage practice ladder, clinician portal, billing, admin/ops stack — 452 commits, 25 Jul-5 Sep 2026 [6].', color: C.teal },
      { text: 'DE-RISKED: formal DCB0129 hazard log, 8 hazards tracked, 6 mitigated; compliance active across 5 frameworks (DCB0129, DTAC, DSPT, MHRA, WCAG), 39 tracked items [3].', color: C.violet },
      { text: 'STILL NEED: capital to complete formal DTAC/DCB0129/DSPT sign-off, first NHS ICB pilot conversation, clinical evidence at scale, SEIS advance assurance completion.', color: C.amber },
    ],
    accentColor: C.teal,
  },
  {
    num: '17',
    title: 'Risk Register & Mitigations: Disclosed, Not Hidden',
    body: '8 formal clinical hazards logged under DCB0129 — 6 mitigated to low residual risk, 2 open with active mitigation in progress [3].',
    bullets: [
      { text: 'Open: clinical boundary confusion — mitigated via explicit "supplementary tool" messaging', color: C.lav },
      { text: 'Open: over-reliance on app — mitigated via SLT hand-off design', color: C.lav },
      { text: 'Mitigated: false positive/negative detection, psychological harm, data breach, device failure, ASR unavailability', color: C.teal },
      { text: 'Business risks: single-founder key-person risk · third-party API dependency (OpenAI Whisper, Agora) · pre-revenue runway · slow NHS procurement cycles', color: C.amber },
    ],
    accentColor: C.rose,
  },
  {
    num: '18',
    title: 'Beyond Stammering: Cross-Sell & Licensing Potential',
    body: 'The real-time amplitude/pitch/voice-tension pipeline isn\'t stammering-specific by construction. Optionality we haven\'t pursued yet, not signed deals.',
    bullets: [
      { text: 'Broader SLT caseload adherence monitoring (voice disorders beyond stammering)', color: C.violet },
      { text: 'Call-centre agent vocal-strain/fatigue monitoring', color: C.violet },
      { text: 'Voice-quality research tooling, licensed to universities/clinics', color: C.violet },
      { text: 'Singing/vocal-coach training feedback', color: C.violet },
    ],
    accentColor: C.violet,
  },
  {
    num: '19',
    title: 'Hypergrowth Scenario: If NHS + International Land Early',
    body: 'Illustrative upside scenario, not a forecast: if ICB pilots convert faster than the base case and Tier-1 international expansion overlaps with Vocali\'s launch instead of following it, the FY5 ARR path (Slide 11) compresses meaningfully — the constraint is clinical evidence and NHS procurement cycles, not product readiness or demand.',
    accentColor: C.amber,
  },
  {
    num: '20',
    title: 'Founder\'s Pledge: Why I\'m Building This',
    body: 'I\'ve stammered since I was 18 months old. I\'ve spent 30+ years navigating a system that too often has nothing to offer between appointments. I built Flowen because I needed it, and because I refuse to accept that the only options are an 18-week wait or £200/hour. Whatever happens with this raise, I\'m not stopping — but the right capital, from the right partner, lets this reach the people who need it faster and more safely. That\'s the pledge: the mission comes before the exit.\n\n[Placeholder draft — to be personalised and approved by the founder before this deck is shared.]',
    accentColor: C.gold,
  },
  {
    num: '21',
    title: 'References & Sources',
    body: '[1] ~1%/~80M global stuttering prevalence — Bloodstein & Ratner; Stuttering Foundation (stutteringhelp.org/prevalence). Some recent reviews report 0.6-0.7% adult prevalence.\n[2] NHS adult stammering wait times vary by trust (reported: 2-6 weeks to several months); coverage gaps exist in some areas — STAMMA (stamma.org).\n[3] Flowen internal DCB0129 hazard log and compliance tracker, as of Sep 2026.\n[4] Microsoft/Nuance, $19.7bn, announced Apr 2021, closed Mar 2022 — Bloomberg, GeekWire, SEC filings.\n[5] ElevenLabs, $500m raised at $11bn valuation, Feb 2026 — public reporting.\n[6] Flowen internal git history: 452 commits, 25 Jul-5 Sep 2026, single founder.\n[7] Stamurai — company self-reported figures (CB Insights, stamurai.com).',
    accentColor: C.lav,
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

  // Title — reserve space for the stat badge (drawn top-right, same y) so a
  // long title wraps around it instead of running underneath it. Only the
  // body width accounted for this before; any slide with both a long-ish
  // title and a stat badge could overlap them (caught while re-rendering
  // after lengthening slide 03's title during an accuracy pass).
  const titleW = slide.stat ? CONTENT_W - 200 : CONTENT_W;
  const titleSize = slide.title.length > 120 ? 16 : slide.title.length > 80 ? 18 : 20;
  text(doc, slide.title, MARGIN, y, { color: C.paper, font: 'Helvetica-Bold', size: titleSize, width: titleW, lineGap: 3 });
  y += doc.heightOfString(slide.title, { width: titleW, lineGap: 3 }) + 10;

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
  text(doc, 'FLOWEN', W / 2 - 100, 160, { color: C.paper, font: 'Helvetica-Bold', size: 40, width: 200, align: 'center' });
  text(doc, 'Fluency & Language Optimization With Empathic Neurofeedback', MARGIN, 208, { color: C.lav, font: 'Helvetica', size: 10, width: CONTENT_W, align: 'center' });

  // Divider
  const [tr, tg, tb] = hexToRgb(C.teal);
  doc.moveTo(W / 2 - 100, 232).lineTo(W / 2 + 100, 232).lineWidth(1).strokeColor([tr, tg, tb]).stroke();

  // Subtitles
  text(doc, 'DEEP TECH · REAL-TIME ACOUSTIC BIOFEEDBACK · DUAL-BRAND GLOBAL SPEECH PLATFORM', MARGIN, 244, { color: C.amber, font: 'Helvetica-Bold', size: 8.5, width: CONTENT_W, align: 'center' });
  text(doc, 'Proprietary Real-Time Acoustic Pipeline · Flowen (Tier 1/2) + Vocali (Tier 3/4) · £8.84bn Combined TAM', MARGIN, 260, { color: C.lavdim, font: 'Helvetica', size: 8, width: CONTENT_W, align: 'center' });

  // Key stats row
  const stats = [
    { v: '80M+', l: 'Global PWS' },
    { v: '£8.84bn', l: 'Combined TAM' },
    { v: '30–40×', l: 'Exit Target' },
    { v: '£350k', l: 'Pre-Seed SEIS' },
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
          Keywords: 'Flowen Vocali speech stammer acoustic biofeedback deep tech SEIS',
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
