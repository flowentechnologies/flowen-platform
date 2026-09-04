#!/usr/bin/env node
// Drafts a general/adaptable SBRI Healthcare Phase 1 application for Flowen,
// structured against the real, published SBRI Healthcare Phase 1 assessment
// criteria (verified against a live Invitation to Tender document — the
// weighted criteria are consistent across SBRI Healthcare competitions
// regardless of theme). NOT mapped to a specific open competition — none
// matching Flowen's use case (speech/language therapy, stammering) was
// found live as of drafting; this is meant to be adapted into a real
// competition's actual online application form once one opens.
//
// Every factual claim is sourced from Flowen's own tracked system data
// (compliance_items, hazard_log, cap_table_entries, ip_audit_items,
// roadmap_milestones) — nothing about clinical safety, data protection, or
// regulatory status is invented, and status is stated as it actually is
// (in_progress / not_started), not overclaimed. This matters legally: SBRI
// Healthcare is a public procurement process — misrepresenting compliance
// status in a bid is a real legal exposure, not just a drafting risk.
import PDFDocument from 'pdfkit';
import { writeFileSync } from 'fs';

const DOC_TITLE = 'Flowen — SBRI Healthcare Phase 1 Application (Working Draft)';

function h1(doc, text) {
  if (doc.y > 60) doc.moveDown(1);
  doc.fontSize(15).font('Helvetica-Bold').fillColor('#0C0E1A').text(text);
  doc.moveDown(0.3);
}
function h2(doc, text) {
  doc.moveDown(0.6);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#8B5CF6').text(text);
  doc.moveDown(0.15);
}
function p(doc, text) {
  doc.fontSize(9.5).font('Helvetica').fillColor('#1a1a1a').text(text, { align: 'left', lineGap: 2 });
  doc.moveDown(0.4);
}
function bullet(doc, text) {
  doc.fontSize(9.5).font('Helvetica').fillColor('#1a1a1a').text(`•  ${text}`, { indent: 10, lineGap: 2 });
}
function note(doc, text) {
  doc.moveDown(0.3);
  doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#8B5CF6').text(`[DRAFTING NOTE — remove before submission] ${text}`, { lineGap: 1 });
  doc.moveDown(0.3);
}

const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
const chunks = [];
doc.on('data', (c) => chunks.push(c));

// ── Cover ──────────────────────────────────────────────────────────────────
doc.fontSize(10).font('Helvetica-Bold').fillColor('#8B5CF6').text('FLOWEN TECHNOLOGIES LTD — CONFIDENTIAL DRAFT');
doc.moveDown(2);
doc.fontSize(22).font('Helvetica-Bold').fillColor('#0C0E1A').text('SBRI Healthcare', { align: 'left' });
doc.fontSize(22).font('Helvetica-Bold').fillColor('#0C0E1A').text('Phase 1 Application', { align: 'left' });
doc.moveDown(0.5);
doc.fontSize(11).font('Helvetica').fillColor('#555').text('Working draft — general Phase 1 business case, structured against SBRI Healthcare\'s standard published assessment criteria.');
doc.moveDown(1.5);
doc.fontSize(9).font('Helvetica-Bold').fillColor('#E2703A').text('NOT YET MAPPED TO A SPECIFIC OPEN COMPETITION.');
doc.fontSize(9).font('Helvetica').fillColor('#555').text('As of drafting, no live SBRI Healthcare competition themed around speech/language therapy or stammering could be identified. Each SBRI Healthcare round has its own Challenge Brief with specific wording and an online application form (submitted via the Research Management System, not by document upload). This draft answers the standard question categories every round uses so it can be adapted quickly once a matching competition opens — copy each section into the corresponding online field and tailor the opening line to that round\'s specific Challenge Brief language.', { lineGap: 2 });
doc.moveDown(1);
doc.fontSize(8.5).font('Helvetica').fillColor('#888').text(`Prepared ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`);
doc.addPage();

// ── 1. Executive summary / unmet need — 20% criterion ────────────────────────
h1(doc, '1. The Challenge & Unmet Need');
note(doc, 'Open by directly quoting/paraphrasing the specific Challenge Brief\'s wording once a matching competition opens — panels score explicitly on "how well the application addresses the challenge brief."');
p(doc, 'An estimated 1% of the global population — around 80 million people — stammer, a lifelong neurodevelopmental speech difference with no cure. In the UK, access to specialist Speech & Language Therapy (SLT) for adults who stammer is severely constrained: NHS SLT capacity is concentrated on paediatric caseloads, waiting lists for adult stammering support routinely run into many months, and therapy that does happen is typically limited to infrequent, short in-clinic sessions — leaving the vast majority of practice, and therefore progress, unsupported between appointments.');
p(doc, 'Flowen addresses this gap directly: a real-time acoustic biofeedback platform that gives people who stammer sub-80ms feedback during self-directed practice, and gives NHS Speech & Language Therapists a way to extend their clinical reach — reviewing session data and adjusting a patient\'s programme remotely — without requiring an in-person appointment for every check-in. Flowen is designed to increase the volume and consistency of practice a person who stammers can access between clinical touchpoints, not to replace the SLT relationship.');
p(doc, 'The founder has lived experience of persistent stammering since the onset of speech (age 18 months) and has spent over 30 years navigating the UK speech therapy pathway as a patient — the product\'s clinical intuition and community trust is founder-led, not externally researched.');

// ── 2. Proposed solution & innovation — feeds the 20% + 15% (IP) criteria ────
h1(doc, '2. Proposed Solution');
p(doc, 'Flowen is a proprietary, phoneme-level automatic speech recognition (ASR) pipeline purpose-built for disfluent speech — general-purpose ASR systems are trained on fluent speech and perform poorly on stammered speech patterns (blocks, prolongations, repetitions), which is precisely the population Flowen serves. The pipeline delivers sub-80ms feedback latency, fast enough to support a speaker mid-sentence rather than only after the fact.');
bullet(doc, 'Real-time acoustic biofeedback during self-directed practice sessions, available on-demand rather than only during scheduled clinic time.');
bullet(doc, 'Automatic session logging (stage, duration, disfluency detail) giving both the user and their SLT a complete, auditable record of engagement — replacing manual self-report.');
bullet(doc, 'Session-over-session fluency trend analytics, generated automatically with zero manual logging required from the user or clinician.');
bullet(doc, 'A clinician-facing caseload view giving an SLT session counts, practice time, and fluency trend for every assigned patient on one screen, with the ability to review and adjust a patient\'s programme remotely.');
bullet(doc, 'On-device processing of voice biomarkers — no raw audio is retained; only derived, anonymised fluency metrics persist (see Section 8, Information Governance).');
doc.moveDown(0.3);
p(doc, 'AI components in scope: Deepgram Nova-2 for disfluency-pattern ASR, and Claude (Anthropic) for session-pattern summarisation. Neither performs autonomous clinical decision-making — every AI output is assistive and surfaced for user or clinician review, documented in Flowen\'s AI Governance Framework (POL-009).');

// ── 3. Project plan, deliverables, risk — 15% ────────────────────────────────
h1(doc, '3. Project Plan, Deliverables & Risk Mitigation');
note(doc, 'Replace this generic 6-month plan with the specific milestones relevant to whatever Challenge Brief this targets — e.g. an NHS pilot with a named ICB, an interoperability spike, or a specific clinical validation study, matched to that brief\'s stated outcomes.');
bullet(doc, 'Months 1–2: Formalise NHS pilot partner engagement (currently in active development — see roadmap); complete the Founder IP Assignment Deed (see Section 4); commission independent penetration testing.');
bullet(doc, 'Months 2–4: Deliver the feasibility study defined by the funded Challenge Brief — technical validation with real (anonymised, consented) session data against defined accuracy/latency success criteria.');
bullet(doc, 'Months 4–5: Structured Patient and Public Involvement (PPIE) sessions with people who stammer via the STAMMA community network (already an active relationship — see Section 6) to validate usability and clinical acceptability.');
bullet(doc, 'Months 5–6: Compile Phase 1 final report and technical/commercial feasibility evidence base; prepare the Phase 2 application, including a full DCB0129 Clinical Safety Case Report once an NHS procuring organisation is confirmed.');
doc.moveDown(0.3);
p(doc, 'Key risks and mitigations (drawn from Flowen\'s existing clinical safety hazard log, DCB0129):');
bullet(doc, 'ASR misclassification (false positive/negative disfluency detection) — mitigated via confidence thresholding, user override, and aggregate session scoring that smooths the impact of any single misclassification.');
bullet(doc, 'Clinical boundary confusion (a user substituting the app for professional therapy) — the highest residual-risk hazard in Flowen\'s log (medium, score 8) — mitigated via explicit onboarding messaging that Flowen is a practice-support tool, not a diagnostic or standalone clinical service, and via SLT-shared reports being clearly labelled as app data rather than clinical assessment.');
bullet(doc, 'Third-party ASR/API dependency (Deepgram) — mitigated via graceful degradation, an offline unscored practice mode, and session auto-save.');

// ── 4. IP arrangements — 15% ──────────────────────────────────────────────────
h1(doc, '4. Intellectual Property');
p(doc, 'Consistent with SBRI Healthcare\'s standard terms, Flowen would retain the intellectual property generated under a Phase 1 contract, with the NHS/funding authority retaining royalty-free, non-exclusive rights of use.');
p(doc, 'Current IP position, stated as it actually stands (an internal audit is in progress — see /admin/ip-docs):');
bullet(doc, 'Founder IP Assignment Deed: in progress. This formally assigns all pre-incorporation IP from the founder to Flowen Technologies Ltd and is treated internally as the single highest-priority item ahead of any external funding round, precisely because most investors and funders require it in place first. Target: complete within Month 1 of any awarded contract, ahead of any development spend.');
bullet(doc, 'Employment/adviser IP clauses: in progress — being verified across all current and future contracts to ensure clean assignment of any IP contribution.');
bullet(doc, 'Freedom-to-operate: the core innovation is the disfluency-specific ASR pipeline and its clinical application design, both developed independently by the founder; no third-party patents are known to read on this approach, though a formal freedom-to-operate search has not yet been commissioned.');
note(doc, 'A funder reviewing this honestly stated IP status may ask about it directly — that is the correct outcome. Overstating IP readiness here is a false representation in a public procurement bid, not just a weak answer.');

// ── 5. Commercialisation & route to NHS — 15% ────────────────────────────────
h1(doc, '5. Commercialisation & Route to Market');
p(doc, 'Flowen\'s go-to-market is structured for the three funding pathways NHS digital health products actually move through: direct-to-consumer subscription (validating demand pre-NHS), NHS commissioning via ICBs/Trusts once DTAC and DCB0129 requirements are met, and DSA/Access to Work funding for individual adult users. G-Cloud 14 supplier registration — the standard route for NHS bodies to procure digital health tools without a full tender — is in progress.');
p(doc, 'Phase 2 goal (subject to Phase 1 success and budget availability): a defined NHS pilot with a named commissioning partner, using the Phase 1 feasibility evidence base to support a full DCB0129 Safety Case Report and a value-based procurement case grounded in reduced SLT appointment load per patient.');

// ── 6. Equity of access & PPIE — 10% ──────────────────────────────────────────
h1(doc, '6. Equity of Access & Patient and Public Involvement');
p(doc, 'Flowen\'s PPIE approach is not a plan to be started if funded — it is how the product already exists. The founder\'s own lived experience of stammering is the primary source of product design decisions, and ongoing user testing runs directly with people who stammer via the STAMMA (British Stammering Association) community network.');
bullet(doc, 'Accessibility-first design throughout: WCAG 2.1 AA compliance in progress, keyboard navigation, screen reader support, and a high-contrast theme.');
bullet(doc, 'An Equality Impact Assessment has been completed (POL-007): no evidence of differential outcome impact by protected characteristic, and the core value proposition (asynchronous, self-directed practice) particularly benefits users for whom frequent in-person clinic attendance is a barrier — those in rural areas, with mobility constraints, or with caring/work commitments limiting availability for clinic-hours appointments.');
bullet(doc, 'Digital-first delivery removes the transport cost and travel time barrier that disproportionately affects lower-income patients accessing NHS SLT services.');

// ── 7. Net zero / environmental impact — 5% ───────────────────────────────────
h1(doc, '7. Environmental Impact & Net Zero Alignment');
p(doc, 'Flowen has no on-premises hardware or physical footprint: it runs entirely on Vercel (serverless compute, CDN) and Supabase (managed Postgres), both cloud infrastructure providers with public renewable-energy commitments. The serverless function model means compute scales to zero between sessions rather than running idle infrastructure continuously.');
p(doc, 'Beyond the platform\'s own footprint, Flowen\'s core value proposition — self-directed practice without a mandatory clinic visit — directly reduces patient travel emissions associated with frequent SLT appointments, contributing to the NHS\'s "Delivering a Net Zero National Health Service" ambition rather than merely avoiding harm.');

// ── 8. Team & delivery capability — 15% ───────────────────────────────────────
h1(doc, '8. Team & Delivery Capability');
p(doc, 'Flowen is founder-led by Howard Henry (Founder & CEO), who has personally built the proprietary disfluent-speech ASR pipeline, the clinical safety framework (acting as Clinical Safety Officer under DCB0129 — see below), and the founding-member community model. This is a case of direct founder-market fit: the founder has navigated the UK adult stammering therapy pathway as a patient for over 30 years, and has direct, pre-existing relationships with PWS (People Who Stammer) communities in the UK and internationally, which is the basis for the PPIE approach described in Section 6.');
p(doc, 'Governance note, stated honestly: the founder currently serves as acting Clinical Safety Officer, documented in the Clinical Safety Management System (POL-006); a formal external CSO appointment is planned prior to NHS go-live, in line with DCB0129 expectations for organisational maturity as the product scales toward NHS deployment.');

// ── 9. Budget — 5% ─────────────────────────────────────────────────────────────
h1(doc, '9. Budget Justification');
p(doc, `Requested: up to £100,000 (NET, excl. VAT) over 6 months — the standard SBRI Healthcare Phase 1 ceiling. Indicative allocation (to be finalised against the specific Challenge Brief's deliverables):`);
bullet(doc, 'Founder/technical labour — core ASR pipeline validation work and NHS pilot partner engagement.');
bullet(doc, 'Clinical/regulatory: independent CREST/NCSC CHECK-approved penetration testing (est. £3,500–£6,000) and Cyber Essentials Plus certification (est. £2,400–£3,900) — both currently unstarted compliance items this funding would directly accelerate.');
bullet(doc, 'PPIE facilitation with the STAMMA community network.');
bullet(doc, 'Cloud infrastructure (Vercel, Supabase, Deepgram API usage) for the feasibility study period.');
note(doc, 'Company financial position (cash in bank, monthly burn, runway) should appear here, but two figures currently recorded in the Flowen system directly contradict each other — venture_config records ~£300 cash / ~£71 monthly burn, while the DTAC compliance register separately asserts an "18-month runway demonstrated." Both cannot be true. Correct /admin/venture before using any specific pound figure for cash position or burn rate in a real submission — an inconsistent number here undermines the "costs justified and appropriate" criterion and, in a public procurement bid, a materially wrong financial figure is a real problem, not a rounding error.');

// ── 10. Regulatory & compliance statement (supporting document) ─────────────
doc.addPage();
h1(doc, 'Supporting Document A — Regulatory & Compliance Statement');
p(doc, 'This statement reflects Flowen\'s compliance status accurately as of the date of this draft, tracked internally against DCB0129 (NHS Clinical Safety), DTAC (Digital Technology Assessment Criteria), and DSPT (Data Security and Protection Toolkit). Status is reported honestly, including items not yet started — this is a public procurement submission and a misrepresented compliance position is a false statement, not a drafting choice.');

h2(doc, 'DCB0129 — Clinical Safety');
bullet(doc, 'Acting Clinical Safety Officer appointed (founder); formal external CSO appointment planned prior to NHS go-live.');
bullet(doc, 'Clinical Safety Management System established and documented (POL-006).');
bullet(doc, '8 clinical hazards formally identified, logged, and risk-assessed using a 5×5 severity × likelihood matrix; all residual risks are medium or below following mitigation. Highest residual risk (medium, score 8): clinical boundary confusion.');
bullet(doc, 'Initial Clinical Safety Case compiled, demonstrating Flowen is acceptably safe as a wellness practice tool for adults with stammering.');
bullet(doc, 'The full DCB0129 Safety Case Report (Annex B) requires a named procuring NHS organisation and has not yet been prepared — it is blocked on exactly the kind of NHS partnership a Phase 1 award would help establish.');

h2(doc, 'DTAC — Digital Technology Assessment Criteria');
bullet(doc, 'Clinical safety, data protection, accessibility, and sustainability strands are in progress (see below and Sections 6–7).');
bullet(doc, 'Not yet started: independent penetration testing (CREST/NCSC CHECK-approved provider required) and FHIR R4/HL7 interoperability with NHS EPR/EHR systems (EMIS, SystmOne) — the latter is roadmapped but not required for the wellness-tool scope of an initial pilot.');
bullet(doc, 'G-Cloud 14 supplier registration in progress.');

h2(doc, 'DSPT / UK GDPR — Data Protection');
bullet(doc, 'Data Protection Officer formally designated; Article 30 Record of Processing Activities maintained across 8 processing activities.');
bullet(doc, 'AES-256 encryption at rest, TLS 1.3 in transit, Postgres Row-Level Security enforced on all user-facing data; service-role database access is server-side only and audit-logged.');
bullet(doc, 'No raw audio is retained — only derived, anonymised fluency metrics persist beyond the active session.');
bullet(doc, '72-hour ICO breach notification procedure documented; ICO registration in progress.');
bullet(doc, 'Not yet started: Cyber Essentials Plus certification, required for DSPT Level 2 and full NHS procurement — directly costed into the Section 9 budget as an accelerant this funding would enable.');

// ── Appendix ──────────────────────────────────────────────────────────────────
doc.addPage();
h1(doc, 'Appendix — Company Snapshot');
p(doc, 'Flowen Technologies Ltd. Pre-seed stage. SEIS advance assurance application submitted to HMRC (15 June 2026) — still awaiting decision, not yet received; do not state this as confirmed elsewhere. Cap table and IP audit maintained internally (see /admin/cap-table, /admin/ip); a full excerpt is available as a separate Data Room document on request and was intentionally not duplicated in full here given the financial data-quality issue noted in Section 9.');
doc.moveDown(1);
doc.fontSize(7.5).font('Helvetica').fillColor('#888').text('FLOWEN TECHNOLOGIES LTD · CONFIDENTIAL WORKING DRAFT — NOT SUBMITTED', { align: 'center' });

doc.end();

doc.on('end', () => {
  const buf = Buffer.concat(chunks);
  writeFileSync('/tmp/flowen-sbri-phase1-application-draft.pdf', buf);
  console.log(`Wrote /tmp/flowen-sbri-phase1-application-draft.pdf (${(buf.length / 1024).toFixed(0)} KB)`);
});
