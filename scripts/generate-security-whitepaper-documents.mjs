#!/usr/bin/env node
// Two more real, already-published pages into the Data Room: /security and
// /whitepaper. Unlike the other extractors, these pages are free-form JSX
// (custom <DocH2>/<DocP>/<DocTable> components) rather than a clean data
// array, so there's no literal to eval — the section content below is
// transcribed verbatim from the live source files
// (src/app/security/page.tsx, src/app/whitepaper/page.tsx), not paraphrased
// or invented. Cross-check against those files if this ever needs updating.
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

// ── Shared renderer ───────────────────────────────────────────────────────
function h1(doc, text) {
  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0C0E1A').text(text);
  doc.moveDown(0.4);
}
function h2(doc, text) {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.6);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0C0E1A').text(text);
  doc.moveDown(0.2);
}
function h3(doc, text) {
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#333').text(text);
  doc.moveDown(0.15);
}
function p(doc, text) {
  doc.fontSize(9).font('Helvetica').fillColor('#1a1a1a').text(text, { lineGap: 2 });
  doc.moveDown(0.35);
}
function bullet(doc, label, detail) {
  const text = detail ? `${label}: ${detail}` : label;
  doc.fontSize(9).font('Helvetica').fillColor('#1a1a1a').text(`•  ${text}`, { indent: 8, lineGap: 2 });
  doc.moveDown(0.15);
}
function callout(doc, text) {
  doc.moveDown(0.2);
  doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#8B5CF6').text(text, { lineGap: 1.5 });
  doc.moveDown(0.35);
}
function table(doc, headers, rows) {
  doc.moveDown(0.2);
  const left = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / headers.length;
  let y = doc.y;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0C0E1A');
  headers.forEach((hd, i) => doc.text(hd.toUpperCase(), left + i * colWidth, y, { width: colWidth - 6 }));
  y += 13;
  doc.moveTo(left, y).lineTo(left + usableWidth, y).strokeColor('#ccc').lineWidth(0.5).stroke();
  y += 5;
  doc.font('Helvetica').fontSize(8).fillColor('#222');
  for (const row of rows) {
    const rowH = Math.max(...row.map((v) => doc.heightOfString(v, { width: colWidth - 6 })), 10) + 6;
    if (y + rowH > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = doc.page.margins.top; }
    row.forEach((v, i) => doc.text(v, left + i * colWidth, y, { width: colWidth - 6 }));
    y += rowH;
  }
  doc.x = left; doc.y = y + 8;
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

// ── /security ─────────────────────────────────────────────────────────────
function buildSecurityPDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#8B5CF6').text('FLOWEN — PUBLIC PAGE — LIVE AT FLOWEN.DIGITAL/SECURITY');
    doc.moveDown(0.3);
    h1(doc, 'Security & Compliance');
    p(doc, 'Flowen is a clinical-grade platform. Our security posture is designed to meet the requirements of NHS Digital, UK GDPR, and the DCB0129 clinical safety standard. This page documents our technical and organisational controls.');
    p(doc, 'Summary: Encryption AES-256 · Transport TLS 1.3 · Data Residency UK-GBR · Clinical Standard DCB0129.');

    const CONTROLS = [
      { category: 'Data Protection', items: [
        ['Encryption at rest', 'AES-256-GCM. All database rows, object storage, and backups are encrypted at rest.'],
        ['Encryption in transit', 'TLS 1.3 minimum. HSTS enforced with 1-year max-age. HTTP Strict Transport Security preloading.'],
        ['Key management', 'Database encryption keys managed by Supabase (UK data centres). Application-layer secrets stored in Vercel encrypted environment variables.'],
        ['Data residency', 'All personal data stored in UK-GBR data centres. No cross-border transfers without an Article 46 safeguard in place.'],
      ]},
      { category: 'Authentication & Access', items: [
        ['User authentication', 'Supabase Auth with JWT tokens. Email/password and magic link. JWT expiry enforced server-side.'],
        ['Row-level security', 'PostgreSQL RLS policies enforce per-user data isolation at the database layer. Service-role access is BYPASSRLS only for privileged backend operations.'],
        ['Admin access', 'Admin routes gated by is_admin flag in profiles table, verified on every request in the proxy layer. Not based on JWT claims alone.'],
        ['API rate limiting', 'In-process rate limiter in proxy.ts: 60 req/min for /api routes, 120 req/min for all other paths, per IP. Distributed limiting via Upstash Redis planned for multi-region.'],
      ]},
      { category: 'Clinical Governance', items: [
        ['Clinical safety standard', 'DCB0129 compliance. Clinical Safety Officer appointed. Hazard Log and Clinical Safety Case Report maintained.'],
        ['Consent audit ledger', 'Immutable, append-only consent_audit_log table. All consent grants, withdrawals, KYC events, and erasure requests are permanently recorded.'],
        ['Data erasure pipeline', "UK GDPR Article 17 right to erasure. apply_gdpr_erasure() function anonymises PII, deletes voice biomarkers and telemetry, and records completion timestamp."],
        ['Voice data', "Raw audio is never persisted. Acoustic biomarkers (RMS, LTI, fundamental frequency) are aggregated per session and subject to the user's configurable retention policy (default: 30 days)."],
      ]},
      { category: 'Infrastructure', items: [
        ['Hosting', 'Vercel (frontend/edge functions). Supabase PostgreSQL (UK data centres). Redis for ephemeral biofeedback state via managed provider.'],
        ['DDoS protection', 'Vercel edge network provides automatic DDoS mitigation. Cloudflare proxying can be activated for additional L3/L4 protection.'],
        ['Vulnerability management', 'Dependencies audited via npm audit and Dependabot. Critical/high CVEs are patched within 72 hours of disclosure.'],
        ['Observability', 'Sentry error monitoring with PHI masking (maskAllText, blockAllMedia). No personally-identifying data captured in error payloads. Error logs retained for 90 days.'],
      ]},
    ];
    for (const group of CONTROLS) {
      h2(doc, group.category);
      for (const [label, detail] of group.items) bullet(doc, label, detail);
    }

    h2(doc, 'DCB0129 Clinical Safety');
    p(doc, 'DCB0129 is the NHS Digital Clinical Safety Standard for Health IT. It requires organisations developing clinical health software to:');
    ['Appoint a Clinical Safety Officer with appropriate clinical and technical competence.',
      'Maintain a Hazard Log identifying clinical risks and mitigation measures.',
      'Produce a Clinical Safety Case Report demonstrating the system is safe for clinical use.',
      'Establish a safety management process covering the full system lifecycle.',
      'Engage with Deployment and Operational Clinical Safety Officers at NHS organisations.',
    ].forEach((t) => bullet(doc, t));
    p(doc, 'Flowen maintains all four DCB0129 artefacts. NHS commissioners can request our Clinical Safety Case Report and Hazard Log summary by contacting security@flowen.digital.');

    h2(doc, 'Responsible Disclosure');
    p(doc, 'If you believe you have found a security vulnerability in Flowen, please report it responsibly. We commit to:');
    ['Acknowledging your report within 48 hours.',
      'Providing a timeline for investigation and resolution.',
      'Not pursuing legal action for good-faith security research.',
      'Crediting researchers in our security acknowledgements (if desired).',
    ].forEach((t) => bullet(doc, t));
    p(doc, 'Report to security@flowen.digital with subject line [SECURITY]. Please include steps to reproduce, impact assessment, and any relevant proof of concept.');

    doc.end();
  });
}

// ── /whitepaper ───────────────────────────────────────────────────────────
function buildWhitepaperPDF() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#8B5CF6').text('FLOWEN — PUBLIC PAGE — LIVE AT FLOWEN.DIGITAL/WHITEPAPER');
    doc.moveDown(0.3);
    h1(doc, 'Flowen: Real-Time Acoustic Biofeedback for Disfluency — Technical & Clinical Overview');
    p(doc, 'White Paper · August 2026 · 25 min read');

    h2(doc, '1. Abstract');
    p(doc, 'Flowen is a cloud-based speech-technology platform that delivers real-time acoustic biofeedback to individuals who stammer, their speech and language therapists (SLTs), and funding bodies including NHS Integrated Care Boards and the Access to Work (AtW) scheme. The platform combines a proprietary disfluency-detecting automatic speech recognition (ASR) pipeline with a dual-waveform visualisation method to provide moment-by-moment feedback on fluency events — blocks, prolongations, and repetitions — during self-directed or clinician-guided practice sessions.');
    p(doc, 'This paper describes the scientific rationale for acoustic biofeedback in stammering therapy, the architecture of the Flowen ASR system, the platform\'s data-privacy and clinical-safety governance, and the intellectual-property landscape. It is intended for clinicians, commissioners, investors, and technical reviewers evaluating the platform.');

    h2(doc, '2. Introduction');
    p(doc, 'Stammering (also called stuttering) is a neurologically based speech disorder affecting approximately 1% of adults worldwide. Despite decades of established therapeutic approaches, access to consistent, measurable practice is a persistent barrier: waiting lists for NHS SLT services frequently exceed 12 months, self-directed practice lacks objective feedback, and progress is difficult to quantify for commissioning purposes.');
    p(doc, 'Flowen was founded in July 2026 by a person who stammers — someone who has lived with the condition for 29 of his 31 years. That founding context is not incidental; it shapes every product decision. The platform was built first as the tool the founder needed and could not find: objective, on-demand feedback available outside the clinic, without a waiting list, without expensive hardware, and without the self-consciousness of practising in front of another person. Flowen deploys consumer-grade device hardware — a smartphone or laptop microphone — and specialist deep-learning models to deliver the kind of acoustic feedback previously available only in specialist clinical settings or expensive hardware devices (e.g. SpeechEasy® delayed auditory feedback devices).');
    callout(doc, "[Scope note from source] This paper covers the platform as deployed at version 2.x (August 2026). Specific model performance figures refer to internal benchmarks on the Flowen proprietary disfluent-speech corpus. Independent clinical validation studies are ongoing.");

    h2(doc, '3. Clinical Rationale');
    h3(doc, '3.1 Prevalence & Burden of Stammering');
    p(doc, 'Stammering affects an estimated 70 million people globally (Bloodstein & Ratner, 2008) and approximately 700,000 adults in the United Kingdom (STAMMA, 2023). The condition carries significant psychosocial burden: adults who stammer report higher rates of anxiety, social avoidance, unemployment, and reduced quality of life compared with fluent speakers (Craig et al., 2009; Briley & Ellis, 2018).');
    p(doc, "NHS England's 2022 Service Specification for Stammering recognises the need for blended delivery models, including digital support, to improve access — particularly for adults in underserved regions where specialist SLT provision is thin.");
    h3(doc, '3.2 Evidence Base for Acoustic Biofeedback');
    p(doc, 'Acoustic biofeedback — the real-time presentation of speech signal characteristics to the speaker — has been investigated as a stammering intervention since the 1960s. The strongest evidence base centres on three modalities:');
    bullet(doc, 'Delayed Auditory Feedback (DAF)', 'Presenting the speaker\'s own voice with a delay of 50–200 ms induces slowed, more fluent speech in many speakers (Lincoln et al., 2006; van Borsel et al., 2003).');
    bullet(doc, 'Frequency-Altered Feedback (FAF)', 'Shifting the pitch of the speaker\'s feedback signal by ±0.5 semitones reduces stuttering frequency in 50–70% of participants in laboratory conditions (Stuart et al., 2004).');
    bullet(doc, 'Visual Biofeedback (VBF)', 'Real-time acoustic visualisations (pitch tracks, spectrograms, waveform displays) facilitate technique acquisition in fluency-shaping programmes, particularly Easy Onset and stretched speech (Onslow et al., 2017; Packman et al., 2014).');
    p(doc, 'Flowen focuses primarily on Visual Biofeedback, augmented with automated disfluency event markers, supported by evidence that self-monitoring via visual display enhances generalisation of fluency techniques beyond the clinic (Euler et al., 2014; Cream et al., 2019).');

    h2(doc, '4. Technology Architecture');
    h3(doc, '4.1 ASR Pipeline Overview');
    p(doc, "Flowen's ASR pipeline processes microphone audio in near-real-time (target latency <300 ms end-to-end). Audio is captured at 16 kHz, 16-bit PCM and processed in overlapping frames of 25 ms with a 10 ms hop.");
    table(doc, ['Stage', 'Component', 'Function'], [
      ['1. Front-end', 'WebAudio API / MediaStream', 'Microphone capture, gain normalisation, VAD gating'],
      ['2. Feature extraction', 'Log-Mel filterbank (80 bins)', 'Convert raw audio to acoustic features for model input'],
      ['3. Disfluency ASR', 'Proprietary fine-tuned transformer', 'Transcription + disfluency token classification'],
      ['4. Formant analysis', 'LPC-based formant tracker', 'F1/F2 extraction for vowel quality biofeedback'],
      ['5. Biofeedback render', 'Web Canvas / SVG', 'Dual-waveform display with event markers'],
    ]);
    p(doc, 'Audio is processed entirely on-device in the browser using WebAssembly where possible, falling back to server-side inference for users on lower-powered devices. No raw audio is transmitted to Flowen servers unless the user explicitly consents to session recording for their own progress review.');

    h3(doc, '4.2 Disfluency Detection Method');
    p(doc, "The core detection model is a transformer-based encoder fine-tuned on Flowen's proprietary disfluent speech corpus. The model outputs three event types at the sub-word level: Blocks (silent/near-silent fixations at word onset, >200ms pre-vocalic silence threshold), Prolongations (abnormal phoneme duration via speaker-adapted z-score), and Repetitions (n-gram matching, minimum 3-token window).");
    p(doc, 'At the time of writing, the model achieves the following performance on the Flowen internal test set (500 sessions, held-out speakers):');
    table(doc, ['Event type', 'Precision', 'Recall', 'F1'], [
      ['Blocks', '0.83', '0.79', '0.81'],
      ['Prolongations', '0.87', '0.84', '0.85'],
      ['Repetitions', '0.91', '0.89', '0.90'],
      ['Overall', '0.87', '0.84', '0.86'],
    ]);
    callout(doc, '[Warning note from source] These figures represent internal benchmarks on consented user data. Independent clinical validation on diverse speaker populations — including accented English speakers and speakers with co-occurring speech disorders — is ongoing. Clinicians should treat automated event counts as indicative rather than diagnostic.');

    h3(doc, '4.3 Biofeedback Rendering — Dual Waveform');
    p(doc, 'Flowen renders two simultaneous waveforms on a shared timeline. The amplitude waveform (top channel) displays the raw speech signal; the formant waveform (bottom channel) tracks first-formant (F1) energy as a proxy for degree-of-voicing and vowel openness. Disfluency events are overlaid as coloured markers: amber for blocks, violet for prolongations, rose for repetitions. A real-time fluency score (0–100) is derived from the weighted sum of event counts per minute. The dual-waveform visualisation approach is a proprietary method currently under assessment for patentability (see Section 8).');

    h2(doc, '5. Data & Privacy');
    p(doc, "Flowen is built to the UK GDPR standard. Lawful basis for processing session data is Article 6(1)(b) — performance of the contract — combined with Article 9(2)(a) explicit consent where health data is processed for model improvement.");
    bullet(doc, 'On-device processing', 'By default, audio is analysed locally in the browser and never transmitted. Only derived metrics are stored.');
    bullet(doc, 'Session recording (opt-in)', 'Consented explicitly at onboarding. Encrypted in transit (TLS 1.3) and at rest (AES-256) in Supabase Storage (EU West region, Frankfurt).');
    bullet(doc, 'Data retention', 'Session metrics retained 36 months. Audio recordings retained 12 months then auto-deleted. Users can export or delete all data via Account Settings.');
    bullet(doc, 'Model training', 'Audio from consented sessions may improve detection models; anonymised via one-way hash before any training batch.');
    bullet(doc, 'Sub-processors', 'Supabase (database/storage, EU), Vercel (compute, EU via IAD1), Stripe (payments), Resend (email). Full DPA at flowen.digital/dpa.');
    p(doc, 'A Subject Access Request (SAR) can be submitted by emailing privacy@flowen.digital.');

    h2(doc, '6. Clinical Safety — DCB0129 Compliance');
    p(doc, "As a digital health tool used in the context of NHS-funded speech therapy, Flowen is subject to NHS England's DCB0129 Clinical Risk Management Standard. Flowen maintains a Clinical Safety Officer, a Clinical Risk Management Plan, a Clinical Risk Management File, and a residual clinical risk classification of Acceptable for all identified hazards at the time of this publication.");
    callout(doc, '[Intended use statement from source] Flowen is a digital therapeutic aid for self-directed fluency practice. It is not a diagnostic device and does not replace clinical assessment by a qualified SLT. Disfluency event counts are provided for informational and self-monitoring purposes only.');

    h2(doc, '7. Accessibility & Funding Pathways');
    bullet(doc, 'Access to Work (AtW)', 'Adults who stammer in employment can apply to DWP\'s Access to Work scheme to fund a Flowen Standard subscription. Typical award: 12 months, renewed annually.');
    bullet(doc, "Disabled Students' Allowance (DSA)", 'Students in higher education can apply for DSA to cover subscription costs.');
    bullet(doc, 'NHS-funded access', 'ICBs can commission Flowen as a group service for NHS SLT departments, with DTAC-aligned evidence packs.');
    bullet(doc, 'Public Funds tier', 'Individuals funded via AtW or NHS receive a complimentary Public Funds subscription tier at no personal cost.');

    h2(doc, '8. Intellectual Property');
    p(doc, "Flowen's core IP assets are held by Flowen Technologies Ltd:");
    table(doc, ['Asset', 'Type', 'Status'], [
      ['Disfluency Detection Method', 'Patent (provisional)', 'Under attorney review — UK/US filing planned'],
      ['Dual-Waveform Biofeedback Method', 'Patent (provisional)', 'Patentability assessment in progress'],
      ['FLOWEN wordmark', 'Trademark — UK Class 42', 'IPO application in progress'],
      ['FLOWEN wordmark', 'Trademark — UK Class 10', 'Filing planned Q4 2026'],
      ['Dual-waveform logomark', 'Trademark', 'Filing planned Q4 2026'],
      ['Platform source code', 'Copyright', 'Automatic UK copyright — registration pending'],
      ['Disfluent speech corpus', 'Database right / copyright', 'Internal — protected under trade secret policy'],
      ['ASR model weights', 'Trade secret / copyright', 'Internal — NDA regime in place'],
    ]);
    p(doc, 'Flowen participates in the UK Patent Box scheme (milestone: first patent granted) and is pursuing R&D Tax Credits (RDEC) for qualifying AI model development expenditure.');

    h2(doc, '9. References');
    [
      'Bloodstein, O., & Ratner, N. B. (2008). A Handbook on Stuttering (6th ed.). Delmar Cengage Learning.',
      'Briley, P. M., & Ellis, C. (2018). The prospective association between stuttering and mental health disorders in a nationally representative sample. Journal of Speech, Language, and Hearing Research, 61(10), 2552–2566.',
      'Craig, A., Blumgart, E., & Tran, Y. (2009). The impact of stuttering on the quality of life in adults who stutter. Journal of Fluency Disorders, 34(2), 61–71.',
      "Cream, A., O'Brian, S., Onslow, M., Packman, A., & Menzies, R. (2019). Self-modelling as a treatment for stuttering. Speech, Language and Hearing, 22(2), 109–118.",
      'Euler, H. A., Gudenberg, A. W. V., Jung, K., & Neumann, K. (2014). Computerised treatment of stuttering: Perceptual assessment of speech quality. Folia Phoniatrica et Logopaedica, 66(4–5), 176–187.',
      'Lincoln, M., Packman, A., & Onslow, M. (2006). Altered auditory feedback and the treatment of stuttering: A review. Journal of Fluency Disorders, 31(2), 71–89.',
      'Onslow, M., Packman, A., & Menzies, R. (2017). Biofeedback in stuttering treatment. In Handbook of Evidenced-Based Practice in Communication Disorders. Plural Publishing.',
      'Packman, A., Onslow, M., & Menzies, R. (2014). Novel speech patterns and the management of stuttering. Disability and Rehabilitation, 22(1–2), 65–79.',
      'STAMMA. (2023). Facts and figures about stammering. Stammering Association. https://stamma.org/about-stammering/facts-and-figures',
      'Stuart, A., Kalinowski, J., Rastatter, M. P., Saltuklaroglu, T., & Dayalu, V. (2004). Investigations of the impact of altered auditory feedback in-the-ear devices on the speech of people who stutter. International Journal of Language & Communication Disorders, 39(2), 215–227.',
      'van Borsel, J., Reunes, G., & Van den Bergh, N. (2003). Delayed auditory feedback in the treatment of stuttering: Clients as consumers. International Journal of Language & Communication Disorders, 38(2), 119–129.',
    ].forEach((ref) => p(doc, ref));

    doc.end();
  });
}

async function main() {
  const secPdf = await buildSecurityPDF();
  await publish({
    title: 'Security & Compliance (Public)',
    category: 'technical',
    description: 'Public security and compliance page, live at flowen.digital/security — encryption, access control, clinical governance, and infrastructure controls.',
    pdfBuffer: secPdf,
  });

  const wpPdf = await buildWhitepaperPDF();
  await publish({
    title: 'Technical & Clinical White Paper',
    category: 'technical',
    description: 'Full technical white paper, live at flowen.digital/whitepaper — clinical rationale, ASR architecture and benchmarks, data privacy, DCB0129 compliance, accessibility/funding pathways, and IP asset table.',
    pdfBuffer: wpPdf,
  });

  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
