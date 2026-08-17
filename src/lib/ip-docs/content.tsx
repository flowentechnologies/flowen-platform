// ── IP Document Content ───────────────────────────────────────────────────────
// All document body content keyed by slug.
// Server-side only — never imported from client components.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';

// ── Shared doc primitives (lightweight, no external deps) ─────────────────────

const H = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-bold text-white mt-10 mb-3 pb-2 border-b border-slate-800">{children}</h2>
);
const H3 = ({ children }: { children: ReactNode }) => (
  <h3 className="text-sm font-bold text-slate-200 mt-7 mb-2">{children}</h3>
);
const P = ({ children }: { children: ReactNode }) => (
  <p className="text-slate-400 text-sm leading-relaxed mb-4">{children}</p>
);
const UL = ({ children }: { children: ReactNode }) => (
  <ul className="space-y-1.5 mb-5 pl-4 list-disc list-outside text-slate-400 text-sm">{children}</ul>
);
const LI = ({ children }: { children: ReactNode }) => <li className="leading-relaxed">{children}</li>;
const Bold = ({ children }: { children: ReactNode }) => <strong className="text-slate-200 font-semibold">{children}</strong>;
const Warn = ({ children }: { children: ReactNode }) => (
  <div className="border-l-2 border-rose-500/40 bg-rose-500/5 rounded-r-xl px-5 py-4 mb-6 text-sm text-rose-300 leading-relaxed">{children}</div>
);
const Note = ({ children }: { children: ReactNode }) => (
  <div className="border-l-2 border-amber-500/40 bg-amber-500/5 rounded-r-xl px-5 py-4 mb-6 text-sm text-amber-300 leading-relaxed">{children}</div>
);
const Blank = () => (
  <span className="inline-block w-48 border-b border-slate-600 align-bottom mx-1" />
);
const Field = ({ label }: { label: string }) => (
  <div className="flex items-end gap-3 mb-3">
    <span className="text-xs text-slate-500 shrink-0 w-36">{label}:</span>
    <span className="flex-1 border-b border-slate-700" />
  </div>
);

// ── Shared table wrapper (horizontal scroll for wide tables) ──────────────────
const TblWrap = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-800 mb-6">
    <table className="w-full text-xs min-w-[700px]">{children}</table>
  </div>
);
const TH = ({ children, w }: { children: ReactNode; w?: string }) => (
  <th className={`text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/60 border-b border-slate-800 ${w ?? ''}`}>{children}</th>
);
const TD = ({ children, mono, muted }: { children: ReactNode; mono?: boolean; muted?: boolean }) => (
  <td className={`px-3 py-2.5 leading-relaxed align-top border-b border-slate-800/60 ${mono ? 'font-mono' : ''} ${muted ? 'text-slate-500' : 'text-slate-400'}`}>{children}</td>
);
const RiskBadge = ({ level }: { level: 'acceptable' | 'investigate' | 'unacceptable' }) => {
  const map = {
    acceptable:   'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400',
    investigate:  'bg-amber-500/10 border border-amber-500/30 text-amber-400',
    unacceptable: 'bg-rose-500/10 border border-rose-500/30 text-rose-400',
  };
  const label = { acceptable: 'Acceptable', investigate: 'Investigate', unacceptable: 'Unacceptable' };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${map[level]}`}>{label[level]}</span>;
};

// ── Document content map ──────────────────────────────────────────────────────

export const CONTENT: Record<string, ReactNode> = {

  // ── Regulatory & Clinical Safety ──────────────────────────────────────────────

  'dcb0129-clinical-safety-case': (
    <>
      <Note>
        DRAFT v1.0 — August 2026. This Clinical Safety Case has been prepared by Flowen Technologies Ltd in accordance with NHS England DCB0129 &quot;Clinical Risk Management by Manufacturers of Health IT Systems.&quot; It must be reviewed and signed off by a named Clinical Safety Officer (CSO) before submission to any NHS or NHS-adjacent organisation. This document does not constitute legal or regulatory advice.
      </Note>

      {/* ── 1. Document Information ── */}
      <H>1. Document Information</H>
      <TblWrap>
        <tbody>
          {[
            ['Document title', 'DCB0129 Clinical Safety Case Report — Flowen Speech Fluency Platform'],
            ['Document reference', 'FLOWEN-CSC-001'],
            ['Version', '1.0 (Draft)'],
            ['Date', 'August 2026'],
            ['Prepared by', 'Flowen Technologies Ltd'],
            ['Clinical Safety Officer (CSO)', '[ To be completed — must hold MBBS or equivalent clinical qualification ]'],
            ['CSO registration number', '[ GMC / HCPC / NMC registration number ]'],
            ['Document owner', 'Flowen Technologies Ltd, England'],
            ['Review cycle', 'At each major software version; annually at minimum; on any adverse event'],
            ['Classification', 'Confidential — share only with named NHS procurement contacts under NDA'],
          ].map(([label, value], i, arr) => (
            <tr key={label} className={i < arr.length - 1 ? 'border-b border-slate-800/60' : ''}>
              <TD mono>{label}</TD>
              <TD>{value}</TD>
            </tr>
          ))}
        </tbody>
      </TblWrap>

      {/* ── 2. Purpose and Scope ── */}
      <H>2. Purpose and Scope</H>
      <P>This Clinical Safety Case (CSC) documents the clinical risk management activities undertaken by Flowen Technologies Ltd in the design, development, and deployment of the Flowen speech fluency platform, in accordance with NHS England standard DCB0129 Edition 2.1.</P>
      <P>The purpose of this document is to demonstrate that:</P>
      <UL>
        <LI>Potential clinical hazards have been systematically identified</LI>
        <LI>The clinical risks arising from those hazards have been assessed and mitigated to an acceptable level</LI>
        <LI>The residual clinical risk of the system is acceptable</LI>
        <LI>The clinical safety of the system is maintained through ongoing risk management</LI>
      </UL>
      <P><Bold>Scope:</Bold> This CSC covers the Flowen web and mobile application (the &quot;System&quot;) including the patient-facing practice interface, the Speech & Language Therapist (SLT) portal, and all backend data processing. It covers use of the System in clinical pathways where the System is used as an adjunct to SLT-led therapy for people who stammer.</P>
      <P><Bold>Out of scope:</Bold> This CSC does not cover any standalone consumer use of the System without SLT involvement, nor does it cover clinical use outside of fluency therapy for stammering.</P>

      {/* ── 3. System Description ── */}
      <H>3. System Description</H>
      <H3>3.1 Overview</H3>
      <P>Flowen is a digital health platform that supports people who stammer (PWS) in practising fluency-shaping and stuttering-modification techniques between SLT appointments. The System uses a device microphone to capture speech during guided practice exercises, applies a proprietary AI-based disfluency detection model to identify and classify disfluency events (blocks, repetitions, prolongations), and provides real-time biofeedback to the patient.</P>
      <H3>3.2 Clinical Use Context</H3>
      <UL>
        <LI><Bold>Intended users:</Bold> Adults who stammer, enrolled and supervised by a registered Speech & Language Therapist</LI>
        <LI><Bold>Clinical setting:</Bold> Between-session home practice, under SLT oversight</LI>
        <LI><Bold>Intended purpose:</Bold> To supplement, not replace, direct SLT therapy; to provide objective practice data to inform SLT clinical decisions</LI>
        <LI><Bold>Not intended for:</Bold> Diagnosis of stammering; replacement of SLT assessment; use without active SLT supervision</LI>
      </UL>
      <H3>3.3 System Architecture</H3>
      <UL>
        <LI><Bold>Frontend:</Bold> Next.js 16 web application (React); iOS native app (in development)</LI>
        <LI><Bold>Backend:</Bold> Supabase (PostgreSQL + Row Level Security); Vercel edge infrastructure</LI>
        <LI><Bold>AI model:</Bold> Proprietary transformer-based ASR with disfluency tokenisation, hosted server-side</LI>
        <LI><Bold>Data at rest:</Bold> AES-256 encryption via Supabase; UK/EU region storage</LI>
        <LI><Bold>Data in transit:</Bold> TLS 1.3 enforced on all connections</LI>
        <LI><Bold>Access control:</Bold> Role-based (patient / SLT / admin); service role key never exposed client-side</LI>
      </UL>
      <H3>3.4 Clinical Data Processed</H3>
      <UL>
        <LI>Audio recordings of practice sessions (processed server-side; not permanently stored by default)</LI>
        <LI>Disfluency event counts per session (blocks, repetitions, prolongations)</LI>
        <LI>Session duration and completion rate</LI>
        <LI>SLT-authored treatment plans and clinical notes</LI>
        <LI>Patient profile data (name, email, HCPC number for SLTs)</LI>
      </UL>

      {/* ── 4. Clinical Risk Management Approach ── */}
      <H>4. Clinical Risk Management Approach</H>
      <P>Flowen Technologies Ltd has adopted a clinical risk management approach aligned with DCB0129 and ISO 14971 (medical device risk management). The following methodology was applied:</P>
      <UL>
        <LI><Bold>Hazard identification:</Bold> Structured brainstorming by the development and clinical advisory team; review of analogous digital health systems; review of reported incidents in similar products</LI>
        <LI><Bold>Risk assessment:</Bold> Each hazard assessed against a 5×5 severity–likelihood matrix (see §5)</LI>
        <LI><Bold>Risk control:</Bold> Controls applied at design, software, and operational levels</LI>
        <LI><Bold>Residual risk:</Bold> Assessed post-control; acceptability determined against the risk matrix</LI>
        <LI><Bold>Review:</Bold> CSC to be reviewed at each major software release, annually, and following any adverse event or near-miss</LI>
      </UL>

      {/* ── 5. Risk Matrix ── */}
      <H>5. Risk Assessment Matrix</H>
      <H3>5.1 Severity Definitions</H3>
      <TblWrap>
        <thead>
          <tr>
            <TH>Level</TH><TH>Label</TH><TH>Definition</TH>
          </tr>
        </thead>
        <tbody>
          {[
            ['S5', 'Catastrophic', 'Patient death'],
            ['S4', 'Major', 'Permanent moderate disability or temporary severe disability'],
            ['S3', 'Significant', 'Temporary moderate disability; psychological harm requiring clinical intervention'],
            ['S2', 'Minor', 'Temporary low disability; brief distress; minor inconvenience'],
            ['S1', 'Negligible', 'No injury or discomfort; no clinical impact'],
          ].map(([lvl, label, def], i, arr) => (
            <tr key={lvl} className={i < arr.length - 1 ? 'border-b border-slate-800/60' : ''}>
              <TD mono>{lvl}</TD><TD><Bold>{label}</Bold></TD><TD>{def}</TD>
            </tr>
          ))}
        </tbody>
      </TblWrap>
      <H3>5.2 Likelihood Definitions</H3>
      <TblWrap>
        <thead>
          <tr>
            <TH>Level</TH><TH>Label</TH><TH>Approximate probability per use</TH>
          </tr>
        </thead>
        <tbody>
          {[
            ['L5', 'Very High', '> 1 in 10'],
            ['L4', 'High', '1 in 10 – 1 in 100'],
            ['L3', 'Medium', '1 in 100 – 1 in 1,000'],
            ['L2', 'Low', '1 in 1,000 – 1 in 10,000'],
            ['L1', 'Very Low', '< 1 in 10,000'],
          ].map(([lvl, label, prob], i, arr) => (
            <tr key={lvl} className={i < arr.length - 1 ? 'border-b border-slate-800/60' : ''}>
              <TD mono>{lvl}</TD><TD><Bold>{label}</Bold></TD><TD>{prob}</TD>
            </tr>
          ))}
        </tbody>
      </TblWrap>
      <H3>5.3 Risk Rating</H3>
      <UL>
        <LI><Bold>Acceptable:</Bold> S1 (any L); S2/L1–L3; S3/L1–L2; S4/L1</LI>
        <LI><Bold>Investigate:</Bold> S2/L4–L5; S3/L3–L4; S4/L2–L3; S5/L1–L2</LI>
        <LI><Bold>Unacceptable:</Bold> S3/L5; S4/L4–L5; S5/L3–L5</LI>
      </UL>
      <P>All identified hazards must reach <Bold>Acceptable</Bold> residual risk before the System may be deployed in a clinical pathway. Any hazard rated <Bold>Investigate</Bold> or higher post-control must be escalated to the CSO before deployment.</P>

      {/* ── 6. Hazard Log ── */}
      <H>6. Hazard Log</H>
      <P>The following table documents all identified clinical hazards, their initial risk rating (before controls), the risk controls applied, and the residual risk rating. All hazards are rated on the 5×5 matrix defined in §5.</P>
      <div className="overflow-x-auto rounded-xl border border-slate-800 mb-6">
        <table className="w-full text-xs" style={{ minWidth: '900px' }}>
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60">
              {['ID', 'Hazard', 'Potential Effect on Patient', 'Initial S', 'Initial L', 'Initial Risk', 'Controls Applied', 'Residual S', 'Residual L', 'Residual Risk', 'Status'].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                id: 'H01',
                hazard: 'AI disfluency detection error (false positive or false negative)',
                effect: 'Misleading progress data; SLT may make suboptimal plan adjustments based on inaccurate session data',
                is: 'S3', il: 'L3', ir: 'investigate' as const,
                controls: 'Model validated on diverse PWS cohort; SLT reviews data with clinical judgement; app clearly labelled adjunct tool; confidence indicators available',
                rs: 'S2', rl: 'L2', rr: 'acceptable' as const,
              },
              {
                id: 'H02',
                hazard: 'System unavailability during scheduled practice session',
                effect: 'Patient unable to complete scheduled practice; minor disruption to therapy routine',
                is: 'S1', il: 'L3', ir: 'acceptable' as const,
                controls: 'Vercel 99.9% uptime SLA; SLT inactivity alert surfaces missed sessions; patient advised to practise manually if app unavailable',
                rs: 'S1', rl: 'L2', rr: 'acceptable' as const,
              },
              {
                id: 'H03',
                hazard: 'Incorrect patient data displayed to SLT (data integrity failure)',
                effect: 'SLT makes clinical decision (plan update, discharge) based on wrong patient\'s data or corrupted session records',
                is: 'S3', il: 'L3', ir: 'investigate' as const,
                controls: 'Supabase RLS enforces patient-scoped data access; patient name/ID shown in page header; audit logging; automated test suite; SLT cross-checks data with patient verbal report',
                rs: 'S2', rl: 'L1', rr: 'acceptable' as const,
              },
              {
                id: 'H04',
                hazard: 'Unauthorised access to patient clinical data',
                effect: 'Privacy breach; psychological harm to patient; regulatory penalty; erosion of therapeutic trust',
                is: 'S3', il: 'L3', ir: 'investigate' as const,
                controls: 'Supabase RLS; service role key server-side only; HTTPS/TLS 1.3; AES-256 at rest; RBAC (patient/SLT/admin roles); GDPR breach notification procedure; penetration testing planned pre-NHS launch',
                rs: 'S2', rl: 'L1', rr: 'acceptable' as const,
              },
              {
                id: 'H05',
                hazard: 'Patient over-reliance on app; delays seeking SLT or medical support',
                effect: 'Clinical deterioration (e.g., increased anxiety, worsening stammering) not addressed due to patient assuming app progress is sufficient',
                is: 'S3', il: 'L2', ir: 'acceptable' as const,
                controls: 'Clinical features gated behind SLT enrolment; SLT inactivity alert triggers after 5 days; in-app messaging to SLT; onboarding explicitly positions app as adjunct tool',
                rs: 'S2', rl: 'L1', rr: 'acceptable' as const,
              },
              {
                id: 'H06',
                hazard: 'Incorrect treatment plan prescribed (wrong stages or targets set)',
                effect: 'Patient practises inappropriate exercise intensity or stage; suboptimal or counterproductive therapy outcomes',
                is: 'S2', il: 'L2', ir: 'acceptable' as const,
                controls: 'SLT sets plan directly in portal with confirmation step; prescribed stages visible to patient; SLT can update plan at any time; plan changes logged in audit trail',
                rs: 'S1', rl: 'L1', rr: 'acceptable' as const,
              },
              {
                id: 'H07',
                hazard: 'Session recording data loss during upload',
                effect: 'SLT loses visibility of one practice session; incomplete clinical record; potential missed deterioration signal',
                is: 'S1', il: 'L3', ir: 'acceptable' as const,
                controls: 'Client-side session buffer; retry logic on failed upload; error notification to patient; single session loss has negligible clinical impact given ongoing data stream',
                rs: 'S1', rl: 'L1', rr: 'acceptable' as const,
              },
              {
                id: 'H08',
                hazard: 'Psychological distress caused by feedback presentation',
                effect: 'Exacerbation of anxiety, shame, or reduced self-efficacy in a clinically vulnerable population (people who stammer); potential avoidance of therapy',
                is: 'S3', il: 'L3', ir: 'investigate' as const,
                controls: 'UX designed without shame-based language or gamification; feedback framed as objective data; SLT oversight and debrief recommended in clinical guidance; patient can pause/exit session at any time; UX reviewed by SLT clinical advisor',
                rs: 'S2', rl: 'L2', rr: 'acceptable' as const,
              },
              {
                id: 'H09',
                hazard: 'Software regression introduces incorrect biofeedback after update',
                effect: 'Patients receive incorrect disfluency data for a period; SLT makes plan decisions on faulty data before regression is detected',
                is: 'S3', il: 'L2', ir: 'acceptable' as const,
                controls: 'CI/CD automated test suite on every commit; TypeScript strict mode; post-deploy monitoring with Sentry; Vercel instant rollback capability; release notes reviewed before production promotion',
                rs: 'S2', rl: 'L1', rr: 'acceptable' as const,
              },
            ].map(row => (
              <tr key={row.id} className="border-b border-slate-800/40 last:border-0">
                <td className="px-3 py-2.5 font-mono text-slate-300 font-bold align-top whitespace-nowrap">{row.id}</td>
                <td className="px-3 py-2.5 text-slate-300 text-xs align-top max-w-[180px]">{row.hazard}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs align-top max-w-[180px]">{row.effect}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs align-top font-mono whitespace-nowrap">{row.is}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs align-top font-mono whitespace-nowrap">{row.il}</td>
                <td className="px-3 py-2.5 align-top whitespace-nowrap"><RiskBadge level={row.ir} /></td>
                <td className="px-3 py-2.5 text-slate-400 text-xs align-top max-w-[200px]">{row.controls}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs align-top font-mono whitespace-nowrap">{row.rs}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs align-top font-mono whitespace-nowrap">{row.rl}</td>
                <td className="px-3 py-2.5 align-top whitespace-nowrap"><RiskBadge level={row.rr} /></td>
                <td className="px-3 py-2.5 align-top"><span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 whitespace-nowrap">Open</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 7. Clinical Maximum Severity Justification ── */}
      <H>7. Maximum Severity Justification</H>
      <P>The maximum initial severity rating applied in this hazard log is <Bold>S3 (Significant)</Bold>. This is justified on the following grounds:</P>
      <UL>
        <LI>The System is explicitly an <Bold>adjunct tool</Bold> — the SLT remains the responsible clinical decision-maker at all times</LI>
        <LI>The System does <Bold>not diagnose</Bold> any condition, does not prescribe medication, and does not administer treatment directly</LI>
        <LI>Any harm arising from System failure would be <Bold>temporary</Bold> and addressable through normal SLT clinical review</LI>
        <LI>The patient population (adults who stammer) is not in acute clinical risk — stammering is a chronic communication condition, not a medical emergency</LI>
        <LI>No scenario has been identified in which System failure could directly cause patient death (S5) or permanent major disability (S4) independent of SLT clinical oversight failure</LI>
      </UL>
      <Note>If the scope of clinical use expands beyond SLT-supervised fluency therapy — for example, to paediatric populations, to unsupervised consumer use, or to any diagnostic function — this severity ceiling must be re-evaluated and this CSC revised accordingly.</Note>

      {/* ── 8. Residual Risk Summary ── */}
      <H>8. Residual Risk Summary</H>
      <TblWrap>
        <thead>
          <tr>
            <TH>Hazard</TH><TH>Residual Risk Rating</TH><TH>Acceptable?</TH>
          </tr>
        </thead>
        <tbody>
          {[
            ['H01 — AI detection error', 'S2/L2 — Acceptable', '✅'],
            ['H02 — System unavailability', 'S1/L2 — Acceptable', '✅'],
            ['H03 — Incorrect data displayed to SLT', 'S2/L1 — Acceptable', '✅'],
            ['H04 — Unauthorised data access', 'S2/L1 — Acceptable', '✅'],
            ['H05 — Patient over-reliance', 'S2/L1 — Acceptable', '✅'],
            ['H06 — Incorrect treatment plan', 'S1/L1 — Acceptable', '✅'],
            ['H07 — Session data loss', 'S1/L1 — Acceptable', '✅'],
            ['H08 — Psychological distress from feedback', 'S2/L2 — Acceptable', '✅'],
            ['H09 — Software regression', 'S2/L1 — Acceptable', '✅'],
          ].map(([hazard, rating, ok], i, arr) => (
            <tr key={hazard} className={i < arr.length - 1 ? 'border-b border-slate-800/60' : ''}>
              <TD>{hazard}</TD><TD>{rating}</TD><TD>{ok}</TD>
            </tr>
          ))}
        </tbody>
      </TblWrap>
      <P>All identified hazards have been mitigated to an <Bold>Acceptable</Bold> residual risk level. No hazard remains at <Bold>Investigate</Bold> or <Bold>Unacceptable</Bold> residual risk. The overall residual clinical risk of the System is therefore assessed as <Bold>Acceptable</Bold>.</P>

      {/* ── 9. Ongoing Clinical Risk Management ── */}
      <H>9. Ongoing Clinical Risk Management</H>
      <H3>9.1 Review Triggers</H3>
      <P>This Clinical Safety Case shall be reviewed and updated in the following circumstances:</P>
      <UL>
        <LI>At each major software version release (major version increment)</LI>
        <LI>Following any adverse event or near-miss involving the System</LI>
        <LI>Following any significant change to the clinical use context or patient population</LI>
        <LI>Annually as a minimum</LI>
        <LI>Following any change in relevant regulation or guidance (NHS England DCB0129 revisions)</LI>
      </UL>
      <H3>9.2 Adverse Event Reporting</H3>
      <P>Flowen Technologies Ltd maintains an adverse event log. Any adverse event or near-miss reported by a patient or SLT that may be attributable to the System shall be:</P>
      <UL>
        <LI>Logged within 24 hours of notification</LI>
        <LI>Reviewed by the CSO within 5 working days</LI>
        <LI>Assessed to determine whether a hazard log update or corrective action is required</LI>
        <LI>Reported to the MHRA if it meets the threshold for a Serious Incident under UK MDR 2002 (as applicable)</LI>
      </UL>
      <H3>9.3 Change Management</H3>
      <P>All software changes are reviewed for clinical safety impact by the development lead before deployment. Changes that introduce new clinical functionality, modify the AI inference pipeline, or affect data access controls trigger a mandatory CSC review by the CSO.</P>

      {/* ── 10. Limitations and Exclusions ── */}
      <H>10. Limitations and Exclusions</H>
      <Warn>
        The following uses are <Bold>outside the intended clinical scope</Bold> of this Clinical Safety Case. Use of the System in these contexts is not covered by this CSC and is not authorised by Flowen Technologies Ltd for NHS-pathway deployment without a separate risk assessment:
      </Warn>
      <UL>
        <LI>Use with patients under 18 years of age</LI>
        <LI>Use without active SLT supervision and enrolment</LI>
        <LI>Use as a diagnostic tool for stammering or any other condition</LI>
        <LI>Use in any acute clinical setting (A&E, inpatient, surgical)</LI>
        <LI>Use in conditions other than stammering / fluency disorders</LI>
        <LI>Use as a substitute for SLT clinical assessment or discharge decision-making</LI>
      </UL>

      {/* ── 11. CSO Declaration ── */}
      <H>11. Clinical Safety Officer Declaration</H>
      <Note>This section must be completed by the appointed Clinical Safety Officer before this document is submitted to any NHS organisation or included in any procurement response. The CSO must hold an appropriate clinical qualification (e.g., MBBS, BDS, or HCPC-registered Allied Health Professional) and must be named on the organisation&apos;s DCB0129 submission.</Note>
      <P>I, the undersigned Clinical Safety Officer, confirm that:</P>
      <UL>
        <LI>I have reviewed this Clinical Safety Case in full</LI>
        <LI>I am satisfied that the clinical hazard identification process was systematic and thorough</LI>
        <LI>I am satisfied that the risk controls described are implemented or planned with clear owners</LI>
        <LI>I am satisfied that the residual clinical risk is acceptable for the intended clinical use described in §2</LI>
        <LI>I accept clinical safety responsibility for this system on behalf of Flowen Technologies Ltd</LI>
      </UL>
      <Field label="CSO name" />
      <Field label="Clinical qualification" />
      <Field label="Registration number (GMC/HCPC/NMC)" />
      <Field label="Signature" />
      <Field label="Date" />
      <Field label="Next scheduled review" />
    </>
  ),

  // ── SEIS Advance Assurance ───────────────────────────────────────────────────

  'seis-advance-assurance': (
    <>
      <Note>
        Draft for review. Items in <span className="text-slate-200 font-semibold">[square brackets]</span> require your specific details before submission.
        Review all financial figures with your accountant and confirm company details via Companies House before posting to HMRC.
        Post by recorded delivery and retain proof of postage. HMRC target response time is 4–6 weeks.
      </Note>

      {/* ── Letter Header ── */}
      <div className="border border-slate-800 rounded-xl p-6 mb-8 text-sm space-y-1.5">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div className="space-y-0.5">
            <p className="text-slate-200 font-semibold">[Director / Authorised Signatory Name]</p>
            <p className="text-slate-400">Flowen Technologies Limited</p>
            <p className="text-slate-400">[Registered Office Address]</p>
            <p className="text-slate-400">[Town, County, Postcode]</p>
            <p className="text-slate-500 text-xs mt-1">flowenspeech@outlook.com</p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-slate-200 font-semibold">HMRC</p>
            <p className="text-slate-400">Venture Capital Reliefs Team</p>
            <p className="text-slate-400">HMRC</p>
            <p className="text-slate-400">BX9 1QR</p>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-800 mt-3">
          <p className="text-slate-500 text-xs">Date: <span className="text-slate-300">[Date of posting]</span></p>
        </div>
        <div className="pt-2">
          <p className="text-slate-200 font-bold text-base">Re: Application for Advance Assurance — Seed Enterprise Investment Scheme (SEIS)</p>
          <p className="text-slate-400 text-xs mt-1">Company: Flowen Technologies Limited &nbsp;|&nbsp; Co. No.: [XXXXXXXX] &nbsp;|&nbsp; UTR: [XXXXXXXXXX]</p>
        </div>
      </div>

      <P>
        Dear Sir or Madam,
      </P>
      <P>
        We write on behalf of <Bold>Flowen Technologies Limited</Bold> ("the Company") to apply for Advance Assurance under
        the Seed Enterprise Investment Scheme (SEIS) in accordance with the Income Tax Act 2007 (ITA 2007),
        Part 5A, as amended by the Finance Act 2023. We respectfully request that HMRC confirms whether
        the proposed share issue described below is likely to qualify for SEIS income tax relief.
      </P>

      <H>1. Company Information</H>

      <TblWrap>
        <thead>
          <tr>
            <TH w="w-48">Field</TH>
            <TH>Details</TH>
          </tr>
        </thead>
        <tbody>
          {[
            ['Full company name',               'Flowen Technologies Limited'],
            ['Companies House number',           '[XXXXXXXX]'],
            ['Unique Taxpayer Reference (UTR)',  '[XXXXXXXXXX]'],
            ['Registered office address',        '[Full registered address including postcode]'],
            ['Principal place of business',      '[If different from registered office]'],
            ['Correspondence address',           '[If different from registered office]'],
            ['Contact person',                   '[Director name] — flowenspeech@outlook.com'],
            ['Date of incorporation',            '[DD Month YYYY]'],
            ['Accounting reference date',        '[DD Month] annually'],
            ['SIC code',                         '62012 — Business and Domestic Software Development'],
            ['Nature of entity',                 'Private company limited by shares'],
          ].map(([f, d]) => (
            <tr key={f}>
              <TD><span className="text-slate-300 font-medium text-xs">{f}</span></TD>
              <TD>{d}</TD>
            </tr>
          ))}
        </tbody>
      </TblWrap>

      <H>2. Description of the Qualifying Trade</H>

      <P>
        The Company develops and operates <Bold>Flowen</Bold> — an AI-powered speech and language therapy support platform
        for adults who stutter. The platform comprises:
      </P>
      <UL>
        <LI><Bold>iOS mobile application</Bold> — enables patients to complete evidence-based fluency shaping exercises
          (diaphragmatic breathing, soft contacts, prolonged speech) with real-time AI detection of blocks,
          repetitions, and prolongations using a proprietary disfluency-aware automatic speech recognition model.</LI>
        <LI><Bold>Clinician web portal</Bold> — provides Speech and Language Therapists (SLTs) with caseload management,
          patient session data, treatment plan configuration, and inactivity alerts to support remote
          therapeutic oversight.</LI>
        <LI><Bold>AI model</Bold> — a fine-tuned automatic speech recognition model trained on proprietary
          disfluent speech datasets to detect and quantify stuttering events.</LI>
      </UL>
      <P>
        The Company's trade is the <Bold>development and commercialisation of proprietary software and AI technology</Bold>.
        Flowen is licensed to end users on a subscription basis (direct-to-consumer and via NHS/private SLT
        practices). The Company's qualifying business activity commenced on <Bold>[Date trade first commenced]</Bold>.
      </P>
      <P>
        This trade is a qualifying trade for the purposes of ITA 2007 s.192 and does not fall within any of the
        excluded activities listed in ITA 2007 s.192(1) and Schedule 7B. In particular, the Company does not carry on
        any financial activities, property development, legal or accountancy services, or energy generation activities.
      </P>

      <H>3. Confirmation of SEIS Qualifying Conditions</H>
      <P>
        We confirm that, at the time of the proposed share issue and to the best of our knowledge and belief,
        the Company satisfies each of the following SEIS qualifying conditions:
      </P>

      <div className="space-y-3 mb-8">
        {[
          ['Not listed on a recognised stock exchange',
           'The Company is a private company limited by shares and is not listed or quoted on any recognised stock exchange, nor does it have any arrangement to become so listed.'],
          ['No controlling interest in another company',
           'The Company does not own or control any subsidiary that is not a qualifying subsidiary. The Company has no subsidiaries.'],
          ['Not under control of another company',
           'The Company is not a subsidiary of, nor is it under the control of, another company. It operates independently.'],
          ['UK permanent establishment',
           'The Company has a permanent establishment in the United Kingdom and carries on its qualifying trade wholly or mainly in the United Kingdom.'],
          ['Gross assets do not exceed £350,000',
           'The Company\'s total gross assets at the date of this letter do not exceed £350,000. [FILL IN: Current gross assets: £_______]. This will also be the case at the time of the share issue.'],
          ['Fewer than 25 full-time equivalent employees',
           'The Company currently has [FILL IN: __ full-time equivalent employees], which is fewer than 25. This includes all directors who are employed by the Company.'],
          ['Company age — within 3 years of first commercial sale',
           'The Company\'s first commercial sale took place on [FILL IN: date]. This is within 3 years of the proposed date of share issue, satisfying the new qualifying business activity condition under ITA 2007 s.257DA as amended by Finance Act 2023.'],
          ['No previous SEIS investment',
           'The Company has not previously received any investment under SEIS, and no SEIS compliance statement (SEIS3) has been issued in respect of the Company.'],
          ['No disqualifying EIS/VCT investment prior to this SEIS issue',
           '[FILL IN: The Company has not received any EIS or VCT investment prior to this SEIS issue / OR: The Company has previously received EIS/VCT investment as follows: ______.] The Company confirms that any prior EIS/VCT investment does not disqualify the proposed SEIS issue.'],
          ['Shares are newly issued ordinary shares',
           'The shares to be issued will be new ordinary shares, carrying no preferential rights to dividends or to assets on a winding-up, and no rights of redemption. They will rank pari passu with all existing ordinary shares.'],
          ['Minimum three-year holding period will be observed',
           'The Company will not take any action within the three years following the share issue that would cause the SEIS conditions to be breached, including making a disqualifying arrangement or returning value to investors.'],
        ].map(([title, body], i) => (
          <div key={i} className="flex gap-3 p-4 border border-slate-800 rounded-xl bg-slate-900/30">
            <span className="shrink-0 mt-0.5 text-emerald-400 text-sm font-bold">✓</span>
            <div>
              <p className="text-slate-200 text-xs font-semibold mb-1">{title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <H>4. Proposed Share Issue</H>

      <TblWrap>
        <thead>
          <tr>
            <TH w="w-56">Item</TH>
            <TH>Details</TH>
          </tr>
        </thead>
        <tbody>
          {[
            ['Total amount to be raised under SEIS',  '[£______] (maximum £250,000 under SEIS — Finance Act 2023)'],
            ['Class of shares',                        'Ordinary shares of [£0.001 / £0.01] nominal value each'],
            ['Number of new shares to be issued',      '[_______ shares]'],
            ['Issue price per share',                  '[£_____] per share'],
            ['Proposed date of share issue',           '[DD Month YYYY — or "on or before [date]"]'],
            ['Will shares rank equally with existing?','Yes — pari passu in all respects with existing ordinary shares'],
            ['Pre-emption rights / subscription rights','[None / describe any arrangement]'],
            ['Post-issue shareholding structure',       '[FILL IN: e.g. Founder A: X%, Founder B: Y%, New investors: Z%]'],
          ].map(([f, d]) => (
            <tr key={f}>
              <TD><span className="text-slate-300 font-medium text-xs">{f}</span></TD>
              <TD>{d}</TD>
            </tr>
          ))}
        </tbody>
      </TblWrap>

      <H>5. Use of Investment Proceeds</H>

      <P>
        The investment will be used wholly for the purposes of the qualifying business activity in accordance
        with ITA 2007 s.257AC(2). The following is the intended allocation:
      </P>

      <TblWrap>
        <thead>
          <tr>
            <TH>Purpose</TH>
            <TH w="w-32">Amount (£)</TH>
            <TH w="w-16">%</TH>
          </tr>
        </thead>
        <tbody>
          {[
            ['iOS application development — features, accessibility, and App Store submission',   '[£      ]', '[  %]'],
            ['AI model training, fine-tuning, and infrastructure (GPU compute, Supabase)',        '[£      ]', '[  %]'],
            ['NHS and private SLT clinical partnership development',                              '[£      ]', '[  %]'],
            ['Regulatory compliance — DCB0129, GDPR, NHS DSPT',                                  '[£      ]', '[  %]'],
            ['Marketing and patient acquisition (Google Ads, SLT referral programme)',            '[£      ]', '[  %]'],
            ['Salaries and working capital',                                                       '[£      ]', '[  %]'],
            ['Legal, accountancy, and corporate governance',                                       '[£      ]', '[  %]'],
          ].map(([purpose, amt, pct]) => (
            <tr key={purpose}>
              <TD>{purpose}</TD>
              <TD mono>{amt}</TD>
              <TD mono muted>{pct}</TD>
            </tr>
          ))}
          <tr>
            <TD><span className="text-slate-200 font-bold text-xs">TOTAL</span></TD>
            <TD mono><span className="text-slate-200 font-bold">[£      ]</span></TD>
            <TD mono><span className="text-slate-200 font-bold">100%</span></TD>
          </tr>
        </tbody>
      </TblWrap>

      <P>
        The Company confirms that none of the investment proceeds will be used for the acquisition of existing
        shares, repayment of loans (other than those used to fund a qualifying business activity), or any
        excluded purpose within the meaning of ITA 2007 Schedule 7B para. 1.
      </P>

      <H>6. Proposed Investors</H>

      <P>
        <Bold>Option A (if investors are known):</Bold> The proposed investors are listed below. We confirm
        that none of them is a connected person within the meaning of ITA 2007 s.257HG (i.e., none is an
        employee, director, or partner of the Company prior to investment, or an associate of such a person,
        except as permitted under the business angel provisions).
      </P>

      <TblWrap>
        <thead>
          <tr>
            <TH>Investor name</TH>
            <TH>Address</TH>
            <TH w="w-32">Amount (£)</TH>
            <TH w="w-24">Connected?</TH>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map(n => (
            <tr key={n}>
              <TD muted>[Name {n}]</TD>
              <TD muted>[Address]</TD>
              <TD muted mono>[£     ]</TD>
              <TD muted>[No / Yes — reason]</TD>
            </tr>
          ))}
        </tbody>
      </TblWrap>

      <P>
        <Bold>Option B (if investors are not yet confirmed):</Bold> The specific investors are not yet identified.
        We request Advance Assurance on the basis of the proposed share issue terms set out in Section 4 above.
        We will provide investor details to HMRC when submitting the compliance statement (SEIS1 / SEIS3)
        following the share issue.
      </P>

      <Warn>
        Delete whichever of Option A / Option B does not apply before submitting.
      </Warn>

      <H>7. Previous Investment Schemes and Convertible Instruments</H>

      <P>
        We confirm the following in relation to previous investment schemes and instruments:
      </P>
      <UL>
        <LI>The Company <Bold>has not</Bold> previously received investment under SEIS.</LI>
        <LI>The Company <Bold>[has not / has — provide details]</Bold> received investment under EIS or via a Venture Capital Trust prior to the proposed SEIS issue. [If yes: provide dates, amounts, and confirm no disqualification arises.]</LI>
        <LI>The Company <Bold>[does not have / has — provide details]</Bold> any convertible loan notes outstanding. [If yes: provide terms and confirm that conversion would not breach the SEIS share condition.]</LI>
        <LI>The Company <Bold>[does not have / has — provide details]</Bold> any outstanding advance subscription agreements (ASAs) or SAFE notes.</LI>
      </UL>

      <H>8. State Aid and Other Government Funding</H>

      <P>
        In accordance with HMRC's requirements and UK subsidy control obligations, we disclose the following
        government funding received or applied for by the Company:
      </P>

      <TblWrap>
        <thead>
          <tr>
            <TH>Funding source / scheme</TH>
            <TH>Amount</TH>
            <TH>Date</TH>
            <TH>Status</TH>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TD muted>[e.g. Innovate UK Smart Grant / SBRI / none]</TD>
            <TD muted mono>[£     ]</TD>
            <TD muted>[Month YYYY]</TD>
            <TD muted>[Awarded / Pending / Not applied]</TD>
          </tr>
        </tbody>
      </TblWrap>

      <P>
        The Company confirms that any government funding received does not constitute de minimis aid that
        would cause the cumulative SEIS/state-aid limit to be exceeded, and does not otherwise affect
        SEIS eligibility under the Finance Act 2023 rules.
      </P>

      <H>9. Declaration</H>

      <P>
        We confirm that, to the best of our knowledge and belief, the information provided in this letter
        and its enclosures is accurate and complete. We understand that:
      </P>
      <UL>
        <LI>Advance Assurance is not a guarantee of relief — individual investors must still satisfy the
            investor-level conditions and submit their own claims (SEIS1).</LI>
        <LI>Any material change to the facts described herein before the share issue must be notified to
            HMRC promptly, as it may affect the assurance given.</LI>
        <LI>Providing false or misleading information may result in penalties under Finance Act 2007 s.97
            and the withdrawal of any relief granted.</LI>
        <LI>HMRC may request additional information or documents to process this application.</LI>
      </UL>

      <div className="mt-6 space-y-3">
        <Field label="Signed" />
        <Field label="Name (print)" />
        <Field label="Capacity (e.g. Director)" />
        <Field label="On behalf of" />
        <Field label="Date" />
      </div>

      <H>10. Enclosures</H>
      <P>Please find enclosed the following documents in support of this application:</P>

      <div className="space-y-2 mb-8">
        {[
          ['☐', 'Latest audited accounts or management accounts (period ending [date])'],
          ['☐', 'Memorandum and Articles of Association (Companies House filed version)'],
          ['☐', 'Draft subscription agreement or investment terms sheet'],
          ['☐', 'Business plan / investor deck (confidential)'],
          ['☐', 'Current cap table (pre- and post-investment)'],
          ['☐', 'Copy of most recent filed Confirmation Statement (CS01)'],
          ['☐', 'Details of any convertible loan notes or ASAs outstanding (if applicable)'],
        ].map(([tick, text]) => (
          <div key={text} className="flex gap-3 items-start text-sm">
            <span className="text-slate-500 shrink-0 font-mono mt-0.5">{tick}</span>
            <span className="text-slate-400">{text}</span>
          </div>
        ))}
      </div>

      <P>
        We would be grateful for HMRC's written confirmation at the earliest opportunity. Please direct
        any queries to the contact named in Section 1 above.
      </P>
      <P>Yours faithfully,</P>

      <div className="mt-6 space-y-3">
        <Field label="Signature" />
        <Field label="Name" />
        <Field label="Director, Flowen Technologies Limited" />
      </div>

      <div className="mt-10 p-5 border border-slate-800 rounded-xl bg-slate-900/20">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">Post-Submission Checklist</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            'Send by Royal Mail Recorded / Special Delivery — retain proof of postage',
            'Keep a signed copy of this letter on file',
            'Calendar a 6-week follow-up date if no response received',
            'Once Advance Assurance received: issue shares and obtain HMRC reference number',
            'After share issue: submit SEIS1 compliance statement within 2 years of end of tax year of investment',
            'Provide SEIS3 certificates to each investor for their tax return',
          ].map((item, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-600 shrink-0 font-mono">☐</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  ),

  // ── Contracts ────────────────────────────────────────────────────────────────

  'founder-ip-assignment-deed': (
    <>
      <Warn>DRAFT TEMPLATE — REQUIRES REVIEW BY A QUALIFIED UK SOLICITOR BEFORE SIGNING. This template is provided for internal planning only and does not constitute legal advice.</Warn>
      <H>Deed of Assignment of Intellectual Property</H>
      <P><Bold>Parties</Bold></P>
      <Field label="Assignor (Founder)" />
      <Field label="Assignor address" />
      <Field label="Assignee (Company)" />
      <P>Flowen Technologies Ltd, a company registered in England and Wales under company number <Blank />, whose registered office is at <Blank /> (the <Bold>&quot;Company&quot;</Bold>).</P>
      <H>Background</H>
      <P>The Assignor has created, developed, or contributed to intellectual property relating to the Flowen speech technology platform, including but not limited to: the disfluency detection method, the dual-waveform biofeedback visualisation method, the ASR model architecture, and the platform software (the <Bold>&quot;Background IP&quot;</Bold>).</P>
      <H>Assignment</H>
      <P>In consideration of <Blank /> and other good and valuable consideration (receipt of which is acknowledged), the Assignor hereby assigns to the Company, with full title guarantee, all right, title, and interest — present and future — in and to the Background IP, including:</P>
      <UL>
        <LI>All patents and patent applications (including provisionals and continuations)</LI>
        <LI>All copyright and related rights in the platform source code, documentation, and models</LI>
        <LI>All database rights in training datasets and corpora</LI>
        <LI>All rights in trade secrets, know-how, and confidential information relating to the platform</LI>
        <LI>All goodwill associated with the above rights</LI>
        <LI>The right to apply for, and claim priority from, any patent or registration worldwide</LI>
        <LI>The right to sue for past infringements of any of the above rights</LI>
      </UL>
      <H>Moral Rights</H>
      <P>To the fullest extent permitted by law, the Assignor irrevocably waives all moral rights in the Background IP in favour of the Company and its successors.</P>
      <H>Further Assurance</H>
      <P>The Assignor agrees, at the Company&apos;s reasonable request and expense, to execute all documents and take all actions reasonably necessary to give effect to this assignment.</P>
      <H>Execution</H>
      <Note>This document must be executed as a deed in the presence of an independent witness and delivered. Delivery may be actual or constructive.</Note>
      <Field label="Signed by Assignor" />
      <Field label="Witness name" />
      <Field label="Witness signature" />
      <Field label="Date" />
      <Field label="Signed for the Company" />
      <Field label="Director / Officer" />
      <Field label="Date" />
    </>
  ),

  'employment-ip-clause': (
    <>
      <Warn>DRAFT TEMPLATE — REQUIRES REVIEW BY A QUALIFIED UK EMPLOYMENT SOLICITOR. Ensure clauses comply with the Patents Act 1977 §39 (employee inventions) and UK copyright law before use.</Warn>
      <H>Employment Contract — IP Addendum Clauses</H>
      <P>The following clauses are designed to be inserted into or appended to Flowen Technologies Ltd standard employment contracts. They supplement — and do not replace — any existing IP provisions.</P>
      <H>1. Definitions</H>
      <P>&quot;<Bold>Company IP</Bold>&quot; means all inventions, developments, discoveries, software, algorithms, models, data, databases, know-how, methods, processes, and works created or contributed to by the Employee in the course of their employment with the Company, whether or not such creations are in the field of the Company&apos;s current or anticipated business.</P>
      <H>2. Ownership of Company IP</H>
      <P>The Employee acknowledges and agrees that all Company IP is, and shall be, the sole and exclusive property of the Company from the moment of creation, to the fullest extent permitted by law.</P>
      <H>3. Assignment of Pre-Employment IP</H>
      <P>Where the Employee brings to the Company any IP created prior to employment (&quot;Prior IP&quot;) that is used in or incorporated into the Company&apos;s products or services, the Employee hereby grants the Company an irrevocable, royalty-free, worldwide licence to use such Prior IP. A schedule of Prior IP retained by the Employee is attached at Annex A.</P>
      <H>4. AI Models and Training Data</H>
      <P>All contributions to the Company&apos;s machine learning models — including dataset curation, labelling, fine-tuning, architecture changes, and model weights — constitute Company IP. The Employee shall not use or reproduce any model weights, training data, or evaluation benchmarks outside the scope of their duties without prior written consent from the Company.</P>
      <H>5. Trade Secrets and Confidentiality</H>
      <P>The Employee shall keep confidential all information relating to the Company&apos;s disfluency detection algorithm, ASR model architecture, proprietary dataset, and any unpublished research, both during and after employment, without limitation of time.</P>
      <H>6. Post-Termination Obligations</H>
      <P>The Employee&apos;s obligations under Clause 5 survive termination of employment without limit of time. Clause 2 and Clause 3 licences are also perpetual and irrevocable.</P>
    </>
  ),

  'adviser-ip-agreement': (
    <>
      <Warn>DRAFT TEMPLATE — REQUIRES REVIEW BY A QUALIFIED UK SOLICITOR BEFORE USE.</Warn>
      <H>Adviser / Consultant IP &amp; Confidentiality Agreement</H>
      <P>Between <Bold>Flowen Technologies Ltd</Bold> (&quot;the Company&quot;) and <Blank /> (&quot;the Adviser&quot;).</P>
      <H>1. Services</H>
      <P>The Adviser agrees to provide advisory or consultancy services to the Company in the field of <Blank /> (&quot;the Services&quot;) commencing <Blank />.</P>
      <H>2. IP Ownership</H>
      <P>All IP created by the Adviser in the course of performing the Services, whether alone or jointly with others, is hereby assigned to the Company with immediate effect and for the full term of protection worldwide, in perpetuity. The Adviser will execute any documents required to perfect this assignment.</P>
      <H>3. Background IP Licence</H>
      <P>Where the Adviser uses their own pre-existing IP (&quot;Background IP&quot;) in the Services, they hereby grant the Company a non-exclusive, irrevocable, worldwide, royalty-free licence to use that Background IP as incorporated into the deliverables.</P>
      <H>4. Confidentiality</H>
      <P>The Adviser will keep confidential all information disclosed by the Company, including technical, commercial, and strategic information, and will not disclose it to any third party or use it for any purpose other than providing the Services, both during and indefinitely after the engagement.</P>
      <H>5. No Conflicting Obligations</H>
      <P>The Adviser warrants that entering this agreement does not conflict with any existing obligation to a third party, and that the Adviser has not used and will not use any third-party confidential information or IP in providing the Services.</P>
    </>
  ),

  // ── AI Models ────────────────────────────────────────────────────────────────

  'asr-ip-assignment-brief': (
    <>
      <Note>INTERNAL DOCUMENT — ACTION REQUIRED. This brief sets out the IP assignment steps needed before any investor term sheet. Estimated completion: 4–6 weeks with a patent attorney.</Note>
      <H>ASR Model IP Assignment — Action Brief</H>
      <P><Bold>Background:</Bold> The Flowen ASR model (disfluency-detecting speech recognition transformer) was developed by the founding team prior to and during early company formation. Ownership must be formally transferred from each founder to the company via a signed Deed of Assignment.</P>
      <H>Scope of IP to Assign</H>
      <UL>
        <LI>Model architecture design and selection decisions</LI>
        <LI>Fine-tuning methodology and training procedures</LI>
        <LI>Hyperparameter configurations and evaluation benchmarks</LI>
        <LI>Model weights (all versions, including intermediate checkpoints)</LI>
        <LI>Inference optimisation techniques (ONNX export, quantisation scripts)</LI>
        <LI>Any patents or patent applications relating to the above</LI>
      </UL>
      <H>Founders Requiring Assignment</H>
      <UL>
        <LI>Howard Henry — founder; contributions: model architecture, training pipeline, disfluency tokenisation</LI>
      </UL>
      <H>Action Steps</H>
      <UL>
        <LI>1. Engage a UK patent attorney to prepare a specific IP Assignment Agreement for ASR model IP</LI>
        <LI>2. List all model versions in the assignment schedule with creation dates and Git SHAs</LI>
        <LI>3. Execute the deed (witnessed, delivered)</LI>
        <LI>4. File with Companies House Intellectual Property register (optional but recommended)</LI>
        <LI>5. Update ip_audit_items record to &apos;complete&apos; with evidence_url pointing to signed deed</LI>
      </UL>
      <H>Investor Diligence Note</H>
      <P>This is flagged as a <Bold>critical blocking item</Bold> for Series A. Most UK and US VCs require verified IP assignment from all founders before issuing a term sheet. Failure to complete this creates significant legal risk in any investment transaction.</P>
    </>
  ),

  'training-data-audit': (
    <>
      <Note>DRAFT — REQUIRES COMPLETION. Fill in all data source entries below and verify licence status before marking complete.</Note>
      <H>AI Training Dataset IP Verification Report</H>
      <P>This report documents all audio corpora and datasets used in training the Flowen disfluency ASR model, with licence status and IP risk assessment for each source.</P>
      <H>Data Sources</H>
      <H3>1. Flowen Proprietary Corpus</H3>
      <UL>
        <LI><Bold>Source:</Bold> User-consented session recordings (opt-in)</LI>
        <LI><Bold>Volume:</Bold> 100,000+ audio clips, approx. 800 hours</LI>
        <LI><Bold>Licence:</Bold> Proprietary — owned by Flowen Technologies Ltd</LI>
        <LI><Bold>Consent basis:</Bold> Explicit GDPR Article 9(2)(a) consent at onboarding</LI>
        <LI><Bold>IP risk:</Bold> Low — internally generated, users waive IP claims in ToS §12</LI>
      </UL>
      <H3>2. UCLASS (Uniformly Collected Library of Autistic Speech)</H3>
      <UL>
        <LI><Bold>Licence:</Bold> Creative Commons Attribution 4.0 (CC-BY-4.0)</LI>
        <LI><Bold>Usage:</Bold> Pre-training on diverse speech patterns</LI>
        <LI><Bold>Attribution required:</Bold> Yes — must credit in model documentation</LI>
        <LI><Bold>IP risk:</Bold> Low — CC-BY-4.0 permits commercial use with attribution</LI>
      </UL>
      <H3>3. Common Voice (Mozilla)</H3>
      <UL>
        <LI><Bold>Licence:</Bold> Creative Commons Zero / CC-0</LI>
        <LI><Bold>Usage:</Bold> Baseline fluent speech representation</LI>
        <LI><Bold>IP risk:</Bold> None — CC-0 is public domain dedication</LI>
      </UL>
      <H3>4. LibriSpeech</H3>
      <UL>
        <LI><Bold>Licence:</Bold> Open (derived from LibriVox — public domain audiobooks)</LI>
        <LI><Bold>Usage:</Bold> Acoustic model pre-training</LI>
        <LI><Bold>IP risk:</Bold> None — public domain source material</LI>
      </UL>
      <H3>5. [Additional sources — TO BE DOCUMENTED]</H3>
      <Note>List all additional datasets used during any training run, including data augmentation libraries, synthetic generation tools, and any datasets sourced from third parties. Confirm licence permits commercial use before including.</Note>
      <H>Summary Assessment</H>
      <UL>
        <LI>All currently documented sources are cleared for commercial use</LI>
        <LI>No GPL, AGPL, or share-alike conditions apply to any dataset</LI>
        <LI>Attribution requirements: Mozilla Common Voice — none; UCLASS — credit required in model card</LI>
        <LI>Action: Complete documentation of all training runs and confirm no undocumented datasets were used</LI>
      </UL>
    </>
  ),

  'licence-compliance-report': (
    <>
      <H>Open-Source Dependency Licence Compliance Report</H>
      <P>Generated August 2026 via <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">npx license-checker --summary --production</code></P>
      <H>Summary</H>
      <div className="rounded-xl border border-slate-800 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-900/60">
            <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">Licence</th>
            <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">Count</th>
            <th className="text-left px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">Commercial Use</th>
          </tr></thead>
          <tbody>
            {[
              ['MIT', '398', '✅ Permitted'],
              ['Apache-2.0', '59', '✅ Permitted'],
              ['ISC', '28', '✅ Permitted'],
              ['BSD-2-Clause', '16', '✅ Permitted'],
              ['BlueOak-1.0.0', '9', '✅ Permitted'],
              ['BSD-3-Clause', '7', '✅ Permitted'],
              ['MPL-2.0', '6', '✅ Permitted (file-level copyleft only)'],
              ['FSL-1.1-MIT', '2', '✅ Permitted'],
              ['LGPL-3.0-or-later', '1', '⚠️ Permitted (dynamic linking only)'],
              ['Others (MIT*, 0BSD, CC-BY-4.0, Unlicense…)', '10', '✅ Permitted'],
            ].map(([lic, n, status], i, arr) => (
              <tr key={lic} className={i < arr.length - 1 ? 'border-b border-slate-800/60' : ''}>
                <td className="px-4 py-2 font-mono text-xs text-slate-300">{lic}</td>
                <td className="px-4 py-2 text-slate-400">{n}</td>
                <td className="px-4 py-2 text-slate-400">{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H>Risk Assessment</H>
      <H3>LGPL-3.0 — @img/sharp-libvips-darwin-arm64</H3>
      <P>Sharp&apos;s native image processing library links to libvips as a <Bold>dynamic library</Bold>. LGPL-3.0 permits commercial use when the library is used via dynamic linking (i.e. you are not distributing modified libvips source or statically linking it). Sharp on Vercel uses precompiled native binaries — this constitutes dynamic linking. <Bold>Risk: Low.</Bold> No action required, but note in FOSS attribution file.</P>
      <H3>MPL-2.0 — Mozilla Public Licence</H3>
      <P>MPL-2.0 is a file-level copyleft: modifications to MPL-licensed files must be disclosed under MPL, but the rest of the codebase is unaffected. Flowen does not modify any MPL-licensed files. <Bold>Risk: None for current usage.</Bold></P>
      <H>Recommended Actions</H>
      <UL>
        <LI>Create a <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">NOTICES.md</code> file in the repo root listing all open-source attributions (MIT licences do not require this but best practice)</LI>
        <LI>Run this scan as part of CI on each release branch</LI>
        <LI>Re-run if any new dependency is added with non-MIT/Apache/BSD licence</LI>
      </UL>
    </>
  ),

  'model-version-control-policy': (
    <>
      <H>AI Model Version Control &amp; Audit Trail Policy</H>
      <P><Bold>Owner:</Bold> Engineering Lead &nbsp;·&nbsp; <Bold>Classification:</Bold> Internal &nbsp;·&nbsp; <Bold>Review cycle:</Bold> Quarterly</P>
      <H>Purpose</H>
      <P>This policy establishes how Flowen Technologies Ltd records, versions, and audits all production and experimental AI model artefacts. The goal is to ensure reproducibility, support investor IP due diligence, and enable clinical safety auditing under DCB0129.</P>
      <H>Scope</H>
      <P>Applies to all ML model weights, tokenisers, configuration files, training scripts, evaluation benchmarks, and ONNX/WASM exports associated with the Flowen ASR disfluency detection pipeline.</P>
      <H>Version Naming</H>
      <P>All model versions follow the schema <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">flowen-asr-vMAJOR.MINOR.PATCH</code>. Production deployments use <Bold>MAJOR.MINOR</Bold>; patch increments cover weight-only hotfixes without architecture changes.</P>
      <H>Registry Requirements</H>
      <P>Every model version committed to the Model Registry must include:</P>
      <UL>
        <LI>SHA-256 checksum of the model weights file</LI>
        <LI>Git commit SHA of the training script used</LI>
        <LI>Training dataset version tag and data provenance record</LI>
        <LI>Evaluation results on the Flowen internal test set (precision/recall/F1 per event type)</LI>
        <LI>Date, author, and sign-off from at least one reviewer</LI>
        <LI>Change description and rationale for any architecture change</LI>
      </UL>
      <H>Production Deployment Gate</H>
      <P>No model may be deployed to production without: (1) passing the evaluation threshold (F1 ≥ 0.80 on all event types); (2) a signed approval in the Model Registry; and (3) a DCB0129 clinical safety review if the change affects disfluency event thresholds.</P>
      <H>Retention</H>
      <P>All model weights are retained indefinitely in encrypted cold storage. Registry entries are immutable — corrections are appended, not overwritten. Registry access is restricted to engineering team and is logged.</P>
    </>
  ),

  // ── Software ─────────────────────────────────────────────────────────────────

  'source-code-assignment': (
    <>
      <Warn>DRAFT TEMPLATE — REQUIRES REVIEW BY A QUALIFIED UK SOLICITOR. Use for all freelance/contractor engagements where IP could otherwise vest in the contractor.</Warn>
      <H>Contractor IP Assignment Agreement</H>
      <P>This Agreement is between <Bold>Flowen Technologies Ltd</Bold> (&quot;the Company&quot;) and <Blank /> (&quot;the Contractor&quot;) dated <Blank />.</P>
      <H>1. Work Made for Hire / Assignment</H>
      <P>All work product, code, designs, documentation, and other deliverables created by the Contractor in connection with services provided to the Company (&quot;Deliverables&quot;) are works made for hire to the fullest extent permitted by applicable law. To the extent any Deliverable does not qualify as a work made for hire, the Contractor hereby irrevocably assigns all right, title, and interest in such Deliverables to the Company.</P>
      <H>2. Pre-Existing IP</H>
      <P>The Contractor may retain ownership of IP created prior to this engagement (&quot;Pre-Existing IP&quot;). Where Pre-Existing IP is incorporated into Deliverables, the Contractor grants the Company an irrevocable, worldwide, royalty-free, sublicensable licence to use such Pre-Existing IP as incorporated. A schedule of Pre-Existing IP is attached hereto.</P>
      <H>3. Open-Source Components</H>
      <P>The Contractor shall not incorporate any open-source software into Deliverables without prior written approval from the Company&apos;s engineering lead. All incorporated open-source components must be disclosed in a FOSS manifest included with the Deliverables.</P>
      <H>4. Moral Rights Waiver</H>
      <P>To the fullest extent permitted by law, the Contractor irrevocably waives all moral rights in the Deliverables.</P>
      <H>5. Confidentiality</H>
      <P>The Contractor will not disclose any Confidential Information of the Company (including source code, model weights, data, business strategy) to any third party, during or after the engagement, without prior written consent.</P>
    </>
  ),

  'copyright-registration-guide': (
    <>
      <H>Software Copyright Registration Guide — UK</H>
      <Note>UK copyright arises automatically on creation — no registration is strictly necessary. This guide covers how to strengthen and evidence copyright ownership for investor due diligence and enforcement purposes.</Note>
      <H>Step 1: Confirm Ownership</H>
      <UL>
        <LI>Verify that IP Assignment Agreements are in place for all founders, employees, and contractors (see Source Code Assignment template)</LI>
        <LI>Document the creation date of the codebase using earliest Git commit timestamps</LI>
      </UL>
      <H>Step 2: Create a Copyright Notice</H>
      <P>Add to all source files: <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">// Copyright © 2026 Flowen Technologies Ltd. All rights reserved.</code></P>
      <H>Step 3: Evidence of Authorship (UK)</H>
      <P>Unlike the US Copyright Office, the UK IPO does not have a software copyright registration system. The recommended approach for evidencing authorship is:</P>
      <UL>
        <LI><Bold>Timestamp with a trusted third party:</Bold> Submit a hash of the codebase to the UK IPO&apos;s &apos;Copyright Notice&apos; service or a trusted timestamping authority (e.g. RFC 3161 timestamp from a reputable TSA)</LI>
        <LI><Bold>Git history as evidence:</Bold> Export a signed Git log as a PDF and store it in the Company&apos;s IP register. GitHub/GitLab provide tamper-evident commit histories</LI>
        <LI><Bold>Notarial deposit:</Bold> Engage a UK solicitor or notary to deposit a sealed copy of the source code. This creates a dated legal record</LI>
      </UL>
      <H>Step 4: US Registration (Optional)</H>
      <P>For US enforcement, register with the US Copyright Office (copyright.gov). Registration is inexpensive (~$65) and enables statutory damages and attorneys&apos; fees in US litigation — valuable if Flowen expands to the US market.</P>
      <H>Step 5: Update IP Register</H>
      <P>Record in the IP audit system: copyright owner, creation date, evidence of authorship method, and date evidence was created.</P>
    </>
  ),

  'dependency-licence-report': (
    <>
      <H>npm Dependency Licence Compliance Report</H>
      <P>This is the same as the Open-Source Component Audit Report. See <Bold>Open-Source Dependency Licence Report</Bold> in the AI Models category, which contains the full <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">license-checker</code> output and risk assessment. The conclusion: all production npm dependencies are cleared for commercial use. One LGPL-3.0 dependency (Sharp/libvips) requires dynamic linking — which Vercel&apos;s deployment model satisfies.</P>
    </>
  ),

  // ── Trade Secrets ─────────────────────────────────────────────────────────────

  'trade-secret-policy': (
    <>
      <H>Flowen Trade Secret Protection Policy</H>
      <P><Bold>Version:</Bold> 1.0 &nbsp;·&nbsp; <Bold>Owner:</Bold> CEO &nbsp;·&nbsp; <Bold>Effective:</Bold> August 2026</P>
      <H>1. Purpose</H>
      <P>This policy sets out how Flowen Technologies Ltd identifies, protects, and enforces its trade secrets. The primary trade secrets are the disfluency detection algorithm, ASR model architecture and weights, proprietary training corpus, and commercially sensitive business information.</P>
      <H>2. What Constitutes a Trade Secret</H>
      <P>Under the Trade Secrets (Enforcement, etc.) Regulations 2018 (implementing EU Directive 2016/943 into UK law — retained post-Brexit), a trade secret is information that: (a) is secret; (b) has commercial value because it is secret; and (c) has been subject to reasonable steps to keep it secret. Flowen designates the following as trade secrets:</P>
      <UL>
        <LI>The disfluency tokenisation and classification algorithm (specific threshold values, feature engineering methods)</LI>
        <LI>Model weights, architecture hyperparameters, and training procedures for the Flowen ASR system</LI>
        <LI>The proprietary disfluent speech corpus and associated metadata</LI>
        <LI>Customer lists, pricing models, and commercial agreements</LI>
      </UL>
      <H>3. Protection Measures</H>
      <UL>
        <LI><Bold>Access control:</Bold> Model weights, training data, and algorithm source code are stored in private repositories with role-based access. Access is granted on a need-to-know basis only</LI>
        <LI><Bold>NDAs:</Bold> All employees, contractors, advisers, and investors receive and sign appropriate NDAs before accessing trade secret information</LI>
        <LI><Bold>Classification:</Bold> Files containing trade secret information are marked CONFIDENTIAL — TRADE SECRET</LI>
        <LI><Bold>Audit trail:</Bold> Access to trade secret repositories is logged. Logs are reviewed monthly</LI>
        <LI><Bold>Physical security:</Bold> No trade secret information is stored unencrypted outside authorised Flowen systems</LI>
      </UL>
      <H>4. Disclosure Procedure</H>
      <P>Before disclosing any trade secret to a third party (including investors), a signed NDA must be in place and approved by the CEO. Disclosures are recorded in the Trade Secret Disclosure Log.</P>
      <H>5. Breach Response</H>
      <P>Any suspected or actual misappropriation of trade secrets must be reported immediately to the CEO. Flowen will seek injunctive relief and damages under the Trade Secrets Regulations and/or common law breach of confidence.</P>
    </>
  ),

  'nda-template': (
    <>
      <Warn>DRAFT TEMPLATE — REQUIRES REVIEW BY A QUALIFIED UK SOLICITOR BEFORE USE.</Warn>
      <H>Mutual Non-Disclosure Agreement</H>
      <P>This Agreement is entered into as of <Blank /> between <Bold>Flowen Technologies Ltd</Bold> (&quot;Flowen&quot;) and <Blank /> (&quot;the Recipient&quot;).</P>
      <H>1. Confidential Information</H>
      <P>&quot;Confidential Information&quot; means any technical, commercial, or strategic information disclosed by Flowen to the Recipient in connection with <Blank />, including but not limited to: source code, model weights, training data, business plans, financial projections, customer data, and any information marked CONFIDENTIAL.</P>
      <H>2. Obligations</H>
      <P>The Recipient shall: (a) keep all Confidential Information strictly confidential; (b) not use Confidential Information for any purpose other than evaluating or executing the Purpose; (c) not disclose Confidential Information to any third party without prior written consent; (d) limit internal disclosure to employees or advisers with a strict need to know, who are themselves bound by written confidentiality obligations.</P>
      <H>3. Exclusions</H>
      <P>Obligations do not apply to information that: (a) is or becomes publicly known through no fault of the Recipient; (b) was rightfully known to the Recipient before disclosure; (c) is independently developed by the Recipient without use of Confidential Information; (d) is required to be disclosed by law (with prior notice to Flowen where permitted).</P>
      <H>4. IP Ownership</H>
      <P>This Agreement does not transfer any IP rights. Nothing in this Agreement shall be construed as a licence to use Flowen&apos;s IP.</P>
      <H>5. Term</H>
      <P>This Agreement is effective for 3 years from the date above. Obligations of confidentiality survive termination for a further 5 years.</P>
      <H>6. Governing Law</H>
      <P>This Agreement is governed by the laws of England and Wales. The parties submit to the exclusive jurisdiction of the courts of England and Wales.</P>
      <H>Signatures</H>
      <Field label="Signed for Flowen" />
      <Field label="Name / Title" />
      <Field label="Date" />
      <Field label="Signed by Recipient" />
      <Field label="Name / Title" />
      <Field label="Date" />
    </>
  ),

  // ── Data & Datasets ───────────────────────────────────────────────────────────

  'dataset-catalogue': (
    <>
      <H>Proprietary Disfluent Speech Dataset Catalogue</H>
      <P><Bold>Classification:</Bold> CONFIDENTIAL — TRADE SECRET &nbsp;·&nbsp; <Bold>Access:</Bold> Engineering &amp; Research only</P>
      <H>Overview</H>
      <P>The Flowen Proprietary Disfluent Speech Corpus is a collection of audio recordings from consented users of the Flowen platform. It represents one of the largest labelled disfluent speech datasets in the UK, collected under GDPR-compliant consent and processed for machine learning use.</P>
      <H>Corpus Statistics (August 2026)</H>
      <UL>
        <LI><Bold>Total clips:</Bold> 100,000+</LI>
        <LI><Bold>Total duration:</Bold> ~800 hours</LI>
        <LI><Bold>Speakers:</Bold> 1,200+ unique consented users</LI>
        <LI><Bold>Languages:</Bold> English (UK) primary; Welsh and Scottish Gaelic subsets</LI>
        <LI><Bold>Event types labelled:</Bold> Blocks, prolongations, part-word repetitions, whole-word repetitions, interjections</LI>
        <LI><Bold>Labelling method:</Bold> Automated pipeline (Flowen ASR) + human expert review on 10% random sample</LI>
      </UL>
      <H>IP Protection Measures</H>
      <UL>
        <LI>All audio stored encrypted (AES-256) in Supabase Storage — EU West region</LI>
        <LI>Access restricted to Flowen engineering team — no third-party access without signed DPA + NDA</LI>
        <LI>Speaker identity separated from audio via one-way hash before any model training batch</LI>
        <LI>Database right applies under UK law (CDPA 1988) — substantial investment in selection and arrangement</LI>
        <LI>Copyright in the compilation vests in Flowen Technologies Ltd</LI>
      </UL>
      <H>Consent Framework Reference</H>
      <P>Consent for training use is collected at onboarding (explicit GDPR Art. 9(2)(a)) and stored in the <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400">profiles.opt_in_telemetry</code> column. Users who withdraw consent have their recordings excluded from subsequent training batches within 30 days.</P>
    </>
  ),

  'gdpr-consent-framework': (
    <>
      <H>Session Data GDPR Consent &amp; Processing Framework</H>
      <P><Bold>Version:</Bold> 2026-07-01 &nbsp;·&nbsp; <Bold>Lawful basis:</Bold> Article 6(1)(b) + Article 9(2)(a)</P>
      <H>Categories of Data Processed</H>
      <UL>
        <LI><Bold>Session metrics</Bold> (event counts, duration, stage scores) — retained 36 months</LI>
        <LI><Bold>Audio recordings</Bold> (opt-in) — retained 12 months, then auto-deleted</LI>
        <LI><Bold>Profile &amp; KYC data</Bold> (name, DOB, role, address) — retained for account lifetime + 7 years (statutory)</LI>
        <LI><Bold>Consent audit log</Bold> — retained indefinitely (legal obligation)</LI>
      </UL>
      <H>Lawful Basis</H>
      <UL>
        <LI><Bold>Session metrics + profile:</Bold> Article 6(1)(b) — performance of the service contract</LI>
        <LI><Bold>Audio for model training:</Bold> Article 9(2)(a) — explicit consent (collected at onboarding step 6)</LI>
        <LI><Bold>Marketing communications:</Bold> Article 6(1)(a) — consent (separate opt-in at onboarding)</LI>
      </UL>
      <H>Data Subject Rights</H>
      <UL>
        <LI><Bold>Access:</Bold> Full data export available at Account Settings → Data Export (JSON)</LI>
        <LI><Bold>Erasure:</Bold> Deletion available in settings; audio deleted within 30 days; metrics anonymised</LI>
        <LI><Bold>Withdraw consent:</Bold> Toggle in Settings → Privacy; withdrawal excludes recordings from future training batches within 30 days</LI>
        <LI><Bold>SAR:</Bold> Submit to privacy@flowen.digital — fulfilled within 30 days</LI>
      </UL>
      <H>International Transfers</H>
      <P>All Flowen data is stored in EU/UK data centres (Supabase Frankfurt, Vercel IAD1 — US East but served via EU CDN edge). Where US transfer occurs (e.g. Stripe, Resend), appropriate SCCs/DPAs are in place. Full sub-processor list available in the DPA at flowen.digital/dpa.</P>
    </>
  ),

  'synthetic-data-rights-policy': (
    <>
      <H>Synthetic Data Generation Rights Policy</H>
      <P><Bold>Version:</Bold> 1.0 &nbsp;·&nbsp; <Bold>Effective:</Bold> August 2026</P>
      <H>Purpose</H>
      <P>This policy defines the ownership, licensing, and documentation requirements for any synthetically generated audio data used in Flowen AI model training.</P>
      <H>Definition</H>
      <P>&quot;Synthetic data&quot; means audio generated programmatically rather than recorded from human speakers, including: TTS (text-to-speech) augmentation, data augmentation (pitch shift, noise injection, speed perturbation), voice cloning or voice conversion outputs, and GAN/diffusion-model generated speech.</P>
      <H>Ownership</H>
      <P>Synthetic data generated using Flowen tooling or on Flowen compute, from Flowen-owned inputs, vests in Flowen Technologies Ltd as a database right and/or as a copyright work (to the extent it involves original creative choices in selection or arrangement). The IP Assignment Deeds of relevant employees and contractors cover synthetic data generation as part of their AI model contributions.</P>
      <H>Third-Party Synthesis Tools</H>
      <P>Where synthetic data is generated using third-party TTS or voice synthesis tools, the engineering team must verify:</P>
      <UL>
        <LI>That the tool&apos;s licence permits commercial use of the generated output</LI>
        <LI>That no speaker identity rights or voice likeness rights attach to the synthetic output</LI>
        <LI>That the tool&apos;s training data did not include Flowen proprietary audio</LI>
      </UL>
      <H>Documentation</H>
      <P>All synthetic data batches used in model training must be logged in the training dataset audit with: tool name, version, generation parameters, volume (clips/hours), and IP clearance confirmation.</P>
    </>
  ),

  // ── Patents ───────────────────────────────────────────────────────────────────

  'disfluency-invention-disclosure': (
    <>
      <Note>This invention disclosure is the first step towards a patent application. Share with a UK patent attorney to assess patentability and freedom-to-operate.</Note>
      <H>Invention Disclosure — Disfluency Detection Method</H>
      <Field label="Inventor(s)" />
      <Field label="Filing date" />
      <H>1. Title of Invention</H>
      <P>Method and System for Real-Time Automatic Detection and Classification of Speech Disfluency Events Using Transformer-Based Acoustic Modelling</P>
      <H>2. Field of Invention</H>
      <P>The invention relates to speech processing, specifically to automatic speech recognition (ASR) systems adapted for the detection, temporal localisation, and classification of speech disfluency events — including blocks, prolongations, and repetitions — in continuous speech in real time.</P>
      <H>3. Problem Solved</H>
      <P>Existing ASR systems are optimised for transcription accuracy on fluent speech. They either fail to detect disfluency events or treat them as noise to be filtered. There is no commercially available, real-time, on-device system that accurately distinguishes between blocks, prolongations, and part-word repetitions with sub-word temporal resolution, enabling live biofeedback for people who stammer.</P>
      <H>4. Detailed Description of Invention</H>
      <UL>
        <LI>Audio captured at 16 kHz, 16-bit PCM; preprocessed via log-Mel filterbank (80 bins, 25 ms frames, 10 ms hop)</LI>
        <LI>Proprietary disfluency tokenisation scheme: standard phoneme tokens augmented with BLOCK, PROLONG, REP_START, REP_END special tokens inserted by the labelling pipeline</LI>
        <LI>Transformer encoder fine-tuned on Flowen proprietary disfluent speech corpus (100k+ clips) using the disfluency token scheme</LI>
        <LI>Per-phoneme duration z-score against speaker-adapted norms for prolongation detection threshold</LI>
        <LI>Pre-vocalic silence detector with 200 ms threshold for block detection</LI>
        <LI>N-gram token sequence matcher for repetition detection (minimum window: 3 tokens)</LI>
        <LI>Formant (LPC-based F1/F2) tracker running in parallel for vowel quality biofeedback</LI>
        <LI>WebAssembly ONNX inference enabling on-device real-time processing on standard consumer devices</LI>
      </UL>
      <H>5. Novelty &amp; Inventive Step</H>
      <P>The combination of: (1) disfluency-aware tokenisation scheme; (2) speaker-adaptive duration modelling for event classification; and (3) WebAssembly-enabled real-time on-device inference — applied specifically to stammering biofeedback — is believed to be novel. Prior art search required.</P>
      <H>6. Commercial Value</H>
      <P>The invention enables the Flowen product. It is central to all three revenue streams (consumer subscription, NHS/ICB licensing, AtW-funded enterprise). Estimated addressable market: 700,000 adults in UK + 3 million in US who stammer. No equivalent real-time on-device product currently on market.</P>
      <H>7. Next Steps</H>
      <UL>
        <LI>Prior art search by patent attorney (estimated 2–3 weeks)</LI>
        <LI>Freedom-to-operate analysis against Nuance, SpeechEasy, and academic ASR patents</LI>
        <LI>Provisional UK patent application (estimated £3,000–£8,000 in attorney fees)</LI>
        <LI>PCT application within 12 months of provisional for international protection</LI>
      </UL>
    </>
  ),

  'waveform-prior-art-brief': (
    <>
      <Note>DRAFT — REQUIRES PATENT ATTORNEY REVIEW. This brief summarises the Flowen dual-waveform method and known prior art for patentability assessment.</Note>
      <H>Prior Art Assessment Brief — Dual-Waveform Biofeedback Visualisation</H>
      <H>1. Description of Method</H>
      <P>The Flowen dual-waveform display renders two simultaneous, time-aligned waveform channels:</P>
      <UL>
        <LI><Bold>Channel 1 (Amplitude):</Bold> Traditional oscilloscope-style waveform of the raw speech signal, providing visual feedback on breath support, loudness, and silent periods</LI>
        <LI><Bold>Channel 2 (Formant):</Bold> First-formant (F1) energy envelope derived from LPC analysis, displayed as a secondary waveform below the amplitude waveform, providing visual feedback on vowel quality and voicing onset (Easy Onset technique)</LI>
        <LI><Bold>Overlay:</Bold> Disfluency event markers (colour-coded) overlaid on both channels at the precise temporal position of each detected event</LI>
      </UL>
      <H>2. Known Prior Art</H>
      <UL>
        <LI>Praat (Boersma &amp; Weenink) — spectrogram + pitch track display; no disfluency event overlay; not real-time web-based</LI>
        <LI>SpeechEasy® — DAF/FAF hardware; no waveform display</LI>
        <LI>Speech Viewer III (IBM) — historical VBF tool; single channel; no formant waveform; discontinued</LI>
        <LI>CAFET (Conditioning a Fluency Enhancing Treatment) — EMG biofeedback; not acoustic; not waveform display</LI>
      </UL>
      <H>3. Potential Novelty</H>
      <P>The specific combination of: simultaneous amplitude + LPC-derived formant waveform; real-time disfluency event overlay with sub-100 ms latency; web-based delivery via WebAudio and Canvas API — is believed to be novel. A prior art search is required to confirm this.</P>
      <H>4. Recommended Next Steps</H>
      <UL>
        <LI>Patent attorney to conduct prior art search in USPTO, EPO, and IPO databases</LI>
        <LI>Assess whether the method is sufficiently distinct from Praat&apos;s spectrogram approach to constitute an inventive step</LI>
        <LI>Consider filing as a continuation of the Disfluency Detection Method patent if granted</LI>
      </UL>
    </>
  ),

  // ── Trademarks ────────────────────────────────────────────────────────────────

  'trademark-filing-tracker': (
    <>
      <H>Flowen Trademark Portfolio — Filing Tracker</H>
      <P>All UK trademark applications and registrations for Flowen Technologies Ltd. Updated August 2026.</P>
      <div className="rounded-xl border border-slate-800 overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-900/60">
            {['Mark', 'Class', 'Description', 'Status', 'Filed', 'Reg. No.', 'Renewal'].map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              ['FLOWEN (wordmark)', '42', 'Software-as-a-service; scientific/tech services', '🟡 In Progress', 'Q3 2026', '—', '—'],
              ['FLOWEN (wordmark)', '10', 'Medical devices; therapeutic apparatus', '🔴 Not Filed', '—', '—', '—'],
              ['Dual-waveform logo', '42 + 10', 'Distinctive gradient waveform logomark', '🔴 Not Filed', '—', '—', '—'],
              ['"Every word gets there." (tagline)', '42', 'Registered slogan', '🔴 Not Filed', '—', '—', '—'],
            ].map(([mark, cls, desc, status, filed, reg, renewal], i, arr) => (
              <tr key={mark + cls} className={i < arr.length - 1 ? 'border-b border-slate-800/60' : ''}>
                <td className="px-3 py-2.5 font-medium text-slate-300 text-xs whitespace-nowrap">{mark}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{cls}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs max-w-xs">{desc}</td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">{status}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{filed}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs font-mono">{reg}</td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{renewal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H>Action Items</H>
      <UL>
        <LI><Bold>Class 10 (FLOWEN wordmark):</Bold> File with IPO Q4 2026 — critical for NHS procurement readiness. Estimated cost: £170 online filing fee + attorney review</LI>
        <LI><Bold>Logo trademark:</Bold> Prepare design documentation (high-res version, colour specifications) and file Q4 2026</LI>
        <LI><Bold>Tagline:</Bold> Low priority — file when resources allow. Note: purely descriptive slogans face higher objection risk</LI>
        <LI><Bold>Class 42 (in progress):</Bold> Monitor IPO for examination report — typically issued 2–3 months after filing</LI>
      </UL>
      <H>Notes on UK Trademark Process</H>
      <P>UK trademark applications are examined by the IPO within approximately 2 months. If accepted, the mark is published in the Trade Marks Journal for 2 months of opposition period before registration. Total time from filing to registration: typically 4–6 months if unopposed.</P>
    </>
  ),
};
