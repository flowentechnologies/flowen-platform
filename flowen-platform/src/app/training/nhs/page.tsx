import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable, type TocEntry,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'NHS Implementation Training — Flowen',
  description:
    'Training manual for NHS commissioners and clinical leads implementing Flowen across a Trust or ICB. Covers clinical governance, patient eligibility, referral pathways, DSPT compliance, and escalation.',
};

const TOC: TocEntry[] = [
  { id: 'overview', label: '1. Overview' },
  { id: 'governance', label: '2. Clinical Governance Framework' },
  { id: 'eligibility', label: '3. Patient Eligibility & Referral Pathway', sub: [
    { id: 'criteria', label: 'Inclusion & exclusion criteria' },
    { id: 'pathway', label: 'Referral pathway' },
  ]},
  { id: 'staff-roles', label: '4. Staff Roles & Responsibilities' },
  { id: 'data-security', label: '5. Data Security & DSPT' },
  { id: 'care-pathway', label: '6. Care Pathway Integration' },
  { id: 'audit', label: '7. Audit & Reporting' },
  { id: 'escalation', label: '8. Escalation & Incident Reporting' },
  { id: 'contacts', label: '9. Key Contacts' },
];

export default function NhsTrainingPage() {
  return (
    <DocPageLayout
      tag="NHS"
      tagColor="cyan"
      title="NHS Implementation Training"
      subtitle="A governance and operational guide for NHS commissioners, clinical leads, and service managers implementing Flowen within a Trust, PCN, or Integrated Care Board."
      date="August 2026"
      readTime="30 min"
      toc={TOC}
      parentLabel="Training"
      parentHref="/training"
    >

      {/* ── 1. Overview ── */}
      <DocH2 id="overview">1. Overview</DocH2>
      <DocP>
        This document provides the governance framework and operational procedures for NHS services integrating Flowen as an adjunct technology within fluency therapy pathways. It is intended for clinical leads, service managers, commissioners, and information governance (IG) leads.
      </DocP>
      <DocP>
        Flowen is a Class I Medical Device under UK MDR 2002 (as amended post-Brexit). It delivers real-time acoustic biofeedback during self-directed fluency practice sessions and surfaces telemetry to the responsible Speech & Language Therapist (SLT) via a clinical portal.
      </DocP>
      <DocCallout variant="info">
        <DocP>
          <strong className="text-slate-200">Regulatory status.</strong> Flowen is registered as a Class I Medical Device with the MHRA under UK MDR 2002. Flowen Speech Technology Ltd holds a current UK Establishment Licence. The DCB0129 Clinical Safety Case and Hazard Log are available on request from <strong className="text-slate-300">clinical@flowen.digital</strong>.
        </DocP>
      </DocCallout>

      {/* ── 2. Governance ── */}
      <DocH2 id="governance">2. Clinical Governance Framework</DocH2>
      <DocP>
        Flowen's clinical governance rests on four frameworks:
      </DocP>
      <DocTable
        headers={['Framework', 'Standard', "Flowen's position"]}
        rows={[
          ['Clinical Safety', 'DCB0129', 'Full compliance; Clinical Safety Officer designated; Clinical Safety Case available on request'],
          ['Data Security', 'NHS DSPT / UK GDPR', 'NHS DSPT toolkit completed annually; DPA and DPIA available on request; data stored in UK/EEA only'],
          ['Medical Device', 'UK MDR 2002', 'Class I Medical Device; MHRA registered; post-market surveillance active'],
          ['Clinical Standards', 'RCSLT Position Papers', 'Aligned to RCSLT position on digital tools in fluency therapy (2025)'],
        ]}
      />
      <DocH3>Organisational responsibilities</DocH3>
      <DocP>
        As the implementing NHS organisation, you are the Data Controller under UK GDPR. Flowen acts as a Data Processor. Your responsibilities include:
      </DocP>
      <DocUL>
        <DocLI>Appointing a named Clinical Lead responsible for oversight of the Flowen deployment</DocLI>
        <DocLI>Ensuring your Information Governance team reviews and signs the Data Processing Agreement (DPA)</DocLI>
        <DocLI>Completing a Data Protection Impact Assessment (DPIA) — Flowen's standard DPIA is available as a starting point</DocLI>
        <DocLI>Adding Flowen as a data processor in your organisation's Record of Processing Activities (ROPA)</DocLI>
        <DocLI>Ensuring all SLTs using the portal complete the SLT Training Manual before enrolling patients</DocLI>
        <DocLI>Reviewing Flowen adverse event reports as part of your existing incident management process</DocLI>
      </DocUL>

      {/* ── 3. Eligibility & Pathway ── */}
      <DocH2 id="eligibility">3. Patient Eligibility & Referral Pathway</DocH2>

      <DocH3 id="criteria">Inclusion & exclusion criteria</DocH3>
      <DocTable
        headers={['Criterion', 'Inclusion', 'Exclusion / requires clinical review']}
        rows={[
          ['Diagnosis', 'Developmental stutter, cluttering, or neurogenic dysfluency formally assessed by HCPC-registered SLT', 'Undiagnosed speech difficulty; dysfluency solely attributable to another condition (e.g. ALS) without SLT review'],
          ['Age', '8 years and above', 'Under 8; individual clinical review required for ages 8–11'],
          ['Hearing', 'Sufficient unaided hearing for audio biofeedback', 'Severe to profound hearing loss without assisted hearing; individual review required for mild/moderate loss'],
          ['Device access', 'iOS 15+ or Android 11+', 'No access to compatible device'],
          ['Mental health', 'Stable mental health adequate for independent home practice', 'Active psychotic episode; acute severe anxiety or agoraphobia without review; current inpatient psychiatric admission'],
          ['Literacy', 'Basic app navigation ability, or a carer able to assist', 'No digital access and no carer support'],
        ]}
      />

      <DocH3 id="pathway">Referral pathway</DocH3>
      <DocP>The standard referral pathway for NHS services is:</DocP>
      <DocUL>
        <DocLI><strong className="text-slate-300">Step 1 — Clinical assessment:</strong> SLT confirms diagnosis, severity (SSI-4 or equivalent), and suitability per inclusion criteria above</DocLI>
        <DocLI><strong className="text-slate-300">Step 2 — Consent discussion:</strong> SLT conducts informed consent discussion and documents in clinical notes (Flowen's in-app consent is supplementary)</DocLI>
        <DocLI><strong className="text-slate-300">Step 3 — Patient enrolment:</strong> SLT creates patient profile in the Flowen portal and assigns initial programme</DocLI>
        <DocLI><strong className="text-slate-300">Step 4 — App onboarding:</strong> Patient installs the Flowen app, completes in-app consent, and completes acoustic calibration with SLT guidance (first session or by phone)</DocLI>
        <DocLI><strong className="text-slate-300">Step 5 — Active monitoring:</strong> SLT reviews telemetry weekly; responds to safety flags within timeframes defined in Section 8</DocLI>
        <DocLI><strong className="text-slate-300">Step 6 — Review and discharge:</strong> Formal clinical review at agreed intervals (minimum 8-weekly); discharge when goals met or pathway no longer appropriate</DocLI>
      </DocUL>
      <DocCallout variant="tip">
        <DocP>
          Flowen works best as part of a blended care model — typically 1 face-to-face session per fortnight alongside 3–5 self-directed Flowen sessions per week. Commissioners should reflect this in their service specification.
        </DocP>
      </DocCallout>

      {/* ── 4. Staff Roles ── */}
      <DocH2 id="staff-roles">4. Staff Roles & Responsibilities</DocH2>
      <DocTable
        headers={['Role', 'Responsibilities', 'Portal access level']}
        rows={[
          ['Clinical Lead (SLT)', 'Overall clinical oversight; adverse event review; liaison with Flowen clinical team', 'Full portal access + organisation admin'],
          ['Responsible SLT', 'Patient enrolment, programme management, telemetry review, safety flag response', 'Full portal access for their own caseload only'],
          ['Service Manager', 'Operational oversight; reporting; staff governance', 'Aggregate reporting only — no individual patient data'],
          ['IG / DPO Lead', 'DPA review, DPIA, ROPA update, data subject request handling', 'No portal access — liaises via Clinical Lead'],
          ['Commissioner', 'Contract oversight, outcome monitoring, renewal', 'Aggregate outcome data only via scheduled reports'],
        ]}
      />
      <DocP>
        Staff must not share portal credentials. Leavers must be removed from the portal by the Clinical Lead within 5 working days of their departure. Contact <strong className="text-slate-300">clinical@flowen.digital</strong> to remove a user.
      </DocP>

      {/* ── 5. Data Security ── */}
      <DocH2 id="data-security">5. Data Security & DSPT</DocH2>
      <DocP>
        Flowen's data security posture is designed to meet NHS DSPT requirements and is reviewed annually. Key technical controls:
      </DocP>
      <DocUL>
        <DocLI>All data stored within the UK and EEA (no transfers to third countries)</DocLI>
        <DocLI>TLS 1.3 encryption in transit; AES-256 encryption at rest</DocLI>
        <DocLI>Multi-factor authentication enforced for all portal users</DocLI>
        <DocLI>Role-based access control — SLTs see only their own patients; no cross-organisational data leakage</DocLI>
        <DocLI>Penetration testing conducted annually by a CREST-certified provider; summary report available on request</DocLI>
        <DocLI>Audit logs retained for 7 years, tamper-proof</DocLI>
        <DocLI>Business continuity plan and disaster recovery tested twice annually; RTO ≤ 4 hours, RPO ≤ 1 hour</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>
          <strong className="text-slate-200">No raw audio is stored.</strong> Flowen processes microphone audio on-device in real time and uploads only computed acoustic features (speaking rate, prolongation accuracy, etc.). Raw audio never leaves the patient's device.
        </DocP>
      </DocCallout>
      <DocH3>Data retention</DocH3>
      <DocTable
        headers={['Data type', 'Retention period', 'Basis']}
        rows={[
          ['Patient telemetry and clinical notes', '7 years from last interaction', 'NHS Records Management Code of Practice 2021'],
          ['Under-18 patient records', 'Until age 25 or 8 years after last contact (whichever is later)', 'NHS Records Management Code of Practice 2021'],
          ['Access and audit logs', '7 years', 'Contractual and regulatory'],
          ['Deleted / archived patients', 'Anonymised aggregate telemetry retained; PII deleted within 30 days of deletion request', 'UK GDPR Article 17'],
        ]}
      />

      {/* ── 6. Care Pathway Integration ── */}
      <DocH2 id="care-pathway">6. Care Pathway Integration</DocH2>
      <DocP>
        Flowen is designed to integrate into existing NHS fluency therapy pathways, not replace them. Recommended integration points:
      </DocP>
      <DocUL>
        <DocLI><strong className="text-slate-300">Electronic Patient Record (EPR):</strong> Flowen PDF progress reports should be filed in the patient's EPR at each formal review. Flowen does not integrate directly with SystmOne or EMIS at this time.</DocLI>
        <DocLI><strong className="text-slate-300">Waiting list management:</strong> Flowen can be used during active waiting periods to maintain patient engagement, with appropriate consent and clinical oversight.</DocLI>
        <DocLI><strong className="text-slate-300">Discharge to self-management:</strong> Patients can continue to use the app on a self-managed basis after discharge, subject to a revised consent discussion. The SLT's active monitoring obligation ends at discharge.</DocLI>
        <DocLI><strong className="text-slate-300">Group therapy:</strong> Flowen can complement group fluency programmes. Each patient requires an individual enrolment and responsible SLT.</DocLI>
      </DocUL>

      {/* ── 7. Audit ── */}
      <DocH2 id="audit">7. Audit & Reporting</DocH2>
      <DocP>
        The Clinical Lead receives a monthly summary report by email covering:
      </DocP>
      <DocUL>
        <DocLI>Number of active patients and session volume</DocLI>
        <DocLI>Mean session completion rate across the service</DocLI>
        <DocLI>Safety flags raised and resolution status</DocLI>
        <DocLI>Adverse event count (including zero-count confirmation)</DocLI>
      </DocUL>
      <DocP>
        For commissioner reporting, a quarterly outcome summary can be generated on request. This covers aggregate telemetry trends only — no individually identifiable data — and is formatted to support NHS outcome reporting frameworks.
      </DocP>
      <DocCallout variant="tip">
        <DocP>
          Flowen's clinical team can provide an annual service review report suitable for contract monitoring meetings. Request this at least 10 working days in advance from <strong className="text-slate-300">clinical@flowen.digital</strong>.
        </DocP>
      </DocCallout>

      {/* ── 8. Escalation ── */}
      <DocH2 id="escalation">8. Escalation & Incident Reporting</DocH2>
      <DocTable
        headers={['Scenario', 'Action', 'Timeframe']}
        rows={[
          ['Patient safety concern (non-emergency)', 'Responsible SLT contacts patient; logs in Flowen portal and clinical notes; informs Clinical Lead', 'Within 2 working days'],
          ['Patient safety concern (emergency)', 'Follow your organisation\'s emergency safeguarding pathway; notify Clinical Lead and Flowen immediately', 'Immediately'],
          ['Serious adverse event (device-related)', 'Report to MHRA Yellow Card AND to Flowen via clinical@flowen.digital; log as clinical incident per your organisation\'s policy', 'Within 24 hours'],
          ['Data breach or suspected breach', 'Notify your DPO immediately; notify Flowen via clinical@flowen.digital; assess whether ICO notification required (72-hour window)', 'Immediately on discovery'],
          ['Platform outage (>2 hours)', 'Clinical Lead to contact Flowen support; assess clinical impact; notify affected SLTs', 'Within 4 hours'],
          ['Staff member leaves with portal access', 'Clinical Lead to email clinical@flowen.digital to deactivate account', 'Within 5 working days'],
        ]}
      />
      <DocP>
        All incidents involving Flowen should be logged in your organisation's own incident management system (e.g. Datix) in addition to any notification to Flowen. This is required for your DSPT obligations.
      </DocP>

      {/* ── 9. Contacts ── */}
      <DocH2 id="contacts">9. Key Contacts</DocH2>
      <DocTable
        headers={['Query type', 'Contact', 'Response time']}
        rows={[
          ['Clinical governance & safety', 'clinical@flowen.digital', '2 working days'],
          ['Information governance & DPA', 'clinical@flowen.digital (mark: IG)', '5 working days'],
          ['Technical / platform issue', 'clinical@flowen.digital (mark: TECH)', '1 working day'],
          ['Commissioning & procurement', 'clinical@flowen.digital (mark: COMMISSIONING)', '5 working days'],
          ['MHRA adverse event report', 'yellowcard.mhra.gov.uk + clinical@flowen.digital', '24 hours'],
        ]}
      />
    </DocPageLayout>
  );
}
