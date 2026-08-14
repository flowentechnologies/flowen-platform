import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable, type TocEntry,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'SLT Clinical Training Manual — Flowen',
  description:
    'Official training manual for Speech & Language Therapists using the Flowen SLT portal. Covers patient enrolment, session telemetry, programme management, and clinical governance.',
};

const TOC: TocEntry[] = [
  { id: 'overview', label: '1. Overview & Purpose' },
  { id: 'portal-access', label: '2. Accessing the SLT Portal' },
  { id: 'enrolment', label: '3. Enrolling a Patient', sub: [
    { id: 'eligibility', label: 'Eligibility criteria' },
    { id: 'consent', label: 'Informed consent' },
    { id: 'creating-profile', label: 'Creating the patient profile' },
  ]},
  { id: 'programmes', label: '4. Managing Exercise Programmes' },
  { id: 'telemetry', label: '5. Reading Session Telemetry' },
  { id: 'progress', label: '6. Progress Reports & Discharge' },
  { id: 'safety', label: '7. Clinical Safety Flags' },
  { id: 'data', label: '8. Data Handling & GDPR' },
  { id: 'support', label: '9. Escalation & Support' },
];

export default function SltTrainingPage() {
  return (
    <DocPageLayout
      tag="SLT"
      tagColor="emerald"
      title="SLT Clinical Training Manual"
      subtitle="Everything you need to enrol patients, read session data, manage exercise programmes, and meet your clinical governance obligations on the Flowen platform."
      date="August 2026"
      readTime="25 min"
      toc={TOC}
      parentLabel="Training"
      parentHref="/training"
    >

      {/* ── 1. Overview ── */}
      <DocH2 id="overview">1. Overview & Purpose</DocH2>
      <DocP>
        Flowen is a real-time acoustic biofeedback platform for fluency practice. The SLT portal gives you a clinical view across all your enrolled patients — session attendance, acoustic telemetry, exercise completion rates, and progression milestones — without requiring you to sit in every session.
      </DocP>
      <DocP>
        This manual covers your obligations and capabilities as the responsible clinician on the Flowen system. Read it in full before enrolling your first patient. If anything is unclear, contact <strong className="text-slate-300">clinical@flowen.digital</strong> before proceeding.
      </DocP>
      <DocCallout variant="info">
        <DocP>
          <strong className="text-slate-200">Clinical responsibility note.</strong> Flowen is a Class I Medical Device used as an adjunct to clinical care. It does not replace face-to-face assessment, clinical judgement, or formal fluency therapy. You remain the responsible clinician at all times.
        </DocP>
      </DocCallout>

      {/* ── 2. Portal access ── */}
      <DocH2 id="portal-access">2. Accessing the SLT Portal</DocH2>
      <DocP>
        Your Flowen account is linked to your professional email address. You will receive an invitation email when your organisation has been onboarded. Click the link in the email, set a password, and complete your profile.
      </DocP>
      <DocTable
        headers={['Step', 'Action', 'Notes']}
        rows={[
          ['1', 'Receive invitation email', 'From noreply@flowen.digital — check spam'],
          ['2', 'Set password', 'Minimum 12 characters, must include one number and one symbol'],
          ['3', 'Complete profile', 'HCPC registration number, organisation, and clinical specialism'],
          ['4', 'Enable MFA', 'Required before patient data is accessible — use an authenticator app'],
          ['5', 'Sign data processing agreement', "In-app step; your organisation's DPO may also need to countersign"],
        ]}
      />
      <DocCallout variant="warning">
        <DocP>
          <strong className="text-slate-200">MFA is mandatory.</strong> The portal will not display patient data until multi-factor authentication is enabled. Do not share your credentials or MFA device.
        </DocP>
      </DocCallout>

      {/* ── 3. Enrolment ── */}
      <DocH2 id="enrolment">3. Enrolling a Patient</DocH2>

      <DocH3 id="eligibility">Eligibility criteria</DocH3>
      <DocP>Before enrolling a patient, confirm they meet all of the following criteria:</DocP>
      <DocUL>
        <DocLI>Diagnosed with developmental stuttering, cluttering, or neurogenic dysfluency by an HCPC-registered SLT</DocLI>
        <DocLI>Age 8 or above (parental consent required for under-18s)</DocLI>
        <DocLI>Sufficient hearing to use audio biofeedback without amplification assistance</DocLI>
        <DocLI>Access to a compatible iOS or Android device (iOS 15 / Android 11 or later)</DocLI>
        <DocLI>Basic digital literacy or a carer who can assist with app navigation</DocLI>
        <DocLI>No active psychotic episode, acute agitation, or other contraindication to independent home practice</DocLI>
      </DocUL>
      <DocP>
        If a patient is borderline on any criterion, document your clinical reasoning before proceeding and flag it in the patient's Flowen profile notes field.
      </DocP>

      <DocH3 id="consent">Informed consent</DocH3>
      <DocP>
        Flowen's in-app consent flow covers data processing under UK GDPR. However, you are responsible for ensuring therapeutic consent is properly documented in your clinical records, separate from the Flowen system. The minimum consent discussion must cover:
      </DocP>
      <DocUL>
        <DocLI>What data the app collects (acoustic features, session timing, exercise completion — not raw audio)</DocLI>
        <DocLI>Who can see their data (the patient, you as the responsible SLT, and authorised Flowen staff)</DocLI>
        <DocLI>The voluntary nature of participation and the right to withdraw at any time</DocLI>
        <DocLI>That Flowen is a supplement to, not a replacement for, clinical therapy sessions</DocLI>
      </DocUL>
      <DocCallout variant="tip">
        <DocP>
          <strong className="text-slate-200">Under-18 patients.</strong> A parent or legal guardian must complete the consent flow in the app. The child should also give their assent in writing in your clinical notes.
        </DocP>
      </DocCallout>

      <DocH3 id="creating-profile">Creating the patient profile</DocH3>
      <DocP>
        Navigate to <strong className="text-slate-300">Patients → Add Patient</strong>. Complete all required fields:
      </DocP>
      <DocTable
        headers={['Field', 'Required', 'Notes']}
        rows={[
          ['First name / Last name', 'Yes', 'Used only for your display; patient sees their own name in the app'],
          ['Date of birth', 'Yes', 'Used to verify age eligibility'],
          ['Email address', 'Yes', "Used to send the app invitation; must be the patient's own address"],
          ['Diagnosis', 'Yes', 'Select from dropdown: Developmental Stutter / Cluttering / Neurogenic / Other'],
          ['Severity baseline (SSI-4)', 'Recommended', 'Helps calibrate biofeedback sensitivity thresholds'],
          ['Programme template', 'Yes', 'Choose from your available programmes or build custom'],
          ['Session frequency target', 'Yes', 'Recommended: 3–5 sessions/week, 10–20 min each'],
          ['Clinical notes', 'Optional', 'Visible only to you — not shown to the patient'],
        ]}
      />
      <DocP>
        After saving, the patient receives an app invitation email. They must install the Flowen app and complete onboarding before telemetry begins appearing in your portal.
      </DocP>

      {/* ── 4. Programmes ── */}
      <DocH2 id="programmes">4. Managing Exercise Programmes</DocH2>
      <DocP>
        Each patient is assigned one active programme at a time. A programme is a sequenced set of exercises drawn from Flowen's library of 10 core techniques (prolonged speech, easy onset, light articulatory contact, pull-out, cancellation, and five supporting exercises). You can use a preset template or build a custom programme.
      </DocP>
      <DocH3>Building a custom programme</DocH3>
      <DocUL>
        <DocLI>Navigate to <strong className="text-slate-300">Programmes → New Programme</strong></DocLI>
        <DocLI>Name the programme and set a target duration (recommended 4–8 weeks per stage)</DocLI>
        <DocLI>Add exercises in order — the app presents them sequentially within each session</DocLI>
        <DocLI>Set difficulty parameters for each exercise (speaking rate target, prolongation duration, disfluency threshold)</DocLI>
        <DocLI>Set advancement criteria: a patient must meet a defined accuracy threshold over N consecutive sessions before the system prompts you to advance them</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>
          <strong className="text-slate-200">Advancement is clinician-gated.</strong> The system will notify you when a patient meets advancement criteria, but it will not move them to the next exercise without your confirmation. You always approve progression.
        </DocP>
      </DocCallout>

      {/* ── 5. Telemetry ── */}
      <DocH2 id="telemetry">5. Reading Session Telemetry</DocH2>
      <DocP>
        After each practice session, Flowen uploads acoustic telemetry to the portal. No raw audio is stored — only computed features:
      </DocP>
      <DocTable
        headers={['Metric', 'What it measures', 'Clinical use']}
        rows={[
          ['Speaking rate (syllables/min)', 'Mean and standard deviation of articulation rate during fluent speech', 'Track slowing-down adherence'],
          ['Prolongation accuracy (%)', 'Proportion of target vowels meeting minimum prolongation duration', 'Core measure for prolonged speech technique'],
          ['Onset smoothness score (0–100)', 'Air-flow build-up gradient at syllable onset', 'Measure easy onset technique'],
          ['Disfluency index (%)', 'Proportion of syllables with detected acoustic disfluency markers', 'Overall fluency proxy — not diagnostic'],
          ['Session completion (%)', 'Exercises completed vs prescribed', 'Adherence indicator'],
          ['Latency to start (minutes)', 'Time from notification to session start', 'Motivation and routine indicator'],
        ]}
      />
      <DocP>
        Telemetry is shown on the <strong className="text-slate-300">Patient Detail</strong> screen as a 30-session rolling chart. Use the date range filter to view specific periods.
      </DocP>
      <DocCallout variant="warning">
        <DocP>
          <strong className="text-slate-200">Telemetry is not diagnostic.</strong> Disfluency index is a within-app acoustic estimate only — it is not validated as a clinical assessment tool and should not be used as a formal fluency measure. Use SSI-4 or similar validated instruments for formal reassessment.
        </DocP>
      </DocCallout>

      {/* ── 6. Progress & Discharge ── */}
      <DocH2 id="progress">6. Progress Reports & Discharge</DocH2>
      <DocP>
        Generate a PDF progress report at any time from <strong className="text-slate-300">Patient Detail → Reports → Generate Report</strong>. Reports include:
      </DocP>
      <DocUL>
        <DocLI>Summary statistics over the selected date range</DocLI>
        <DocLI>Session attendance chart</DocLI>
        <DocLI>Technique accuracy trends for each active exercise</DocLI>
        <DocLI>Your clinical notes (optional — toggle before generating)</DocLI>
      </DocUL>
      <DocP>
        Reports are formatted for inclusion in clinical case notes. They include a Flowen version stamp and a notice that data is acoustic telemetry only, not a formal fluency assessment.
      </DocP>
      <DocH3>Discharging a patient</DocH3>
      <DocP>
        When a patient completes their programme or is discharged from your caseload, navigate to <strong className="text-slate-300">Patient Detail → Actions → Archive Patient</strong>. This:
      </DocP>
      <DocUL>
        <DocLI>Removes the patient from your active caseload view</DocLI>
        <DocLI>Sends the patient an in-app notification that their programme has ended</DocLI>
        <DocLI>Retains all telemetry in a read-only archived state for 7 years per NHS records retention guidance</DocLI>
        <DocLI>Does not delete any data from the patient's app until they request deletion under UK GDPR Article 17</DocLI>
      </DocUL>

      {/* ── 7. Safety Flags ── */}
      <DocH2 id="safety">7. Clinical Safety Flags</DocH2>
      <DocP>
        Flowen's safety monitoring system watches for patterns that may warrant clinical review. Flags appear in your portal inbox and as email notifications (if enabled in your profile settings).
      </DocP>
      <DocTable
        headers={['Flag', 'Trigger', 'Recommended action']}
        rows={[
          ['Missed sessions (5+)', '5 or more consecutive missed sessions', 'Contact patient to check welfare; document in clinical notes'],
          ['Disfluency spike', 'Disfluency index ≥ 30% above 7-day baseline for ≥ 3 sessions', 'Review telemetry; consider scheduling a check-in call'],
          ['Adverse event report', 'Patient reports distress or adverse experience via in-app flag', "Contact patient within 2 working days; escalate per your org's safeguarding policy if indicated"],
          ['Inactivity (14 days)', 'No sessions in 14 days', 'Contact patient; consider whether the programme remains appropriate'],
          ['Technical error', 'Repeated calibration failures (>50% of sessions in 7-day window)', 'Advise patient to re-run onboarding calibration; escalate to Flowen support if persistent'],
        ]}
      />
      <DocCallout variant="warning">
        <DocP>
          <strong className="text-slate-200">You are not relieved of safeguarding duties.</strong> Flowen flags are not a substitute for your professional safeguarding obligations. If a patient reports distress or you have any concern for their welfare, follow your organisation's safeguarding procedures regardless of what Flowen flags show.
        </DocP>
      </DocCallout>

      {/* ── 8. Data Handling ── */}
      <DocH2 id="data">8. Data Handling & GDPR</DocH2>
      <DocP>
        Flowen processes patient data as a Data Processor on behalf of your organisation (the Data Controller) under UK GDPR and the Data Protection Act 2018. The legal basis for processing is Article 9(2)(h) — health care purposes.
      </DocP>
      <DocUL>
        <DocLI>All data is stored within the UK and European Economic Area (EEA)</DocLI>
        <DocLI>Data in transit and at rest is encrypted (TLS 1.3 and AES-256)</DocLI>
        <DocLI>Flowen does not sell patient data or use it for any purpose other than providing the platform service</DocLI>
        <DocLI>Patients can request export or deletion of their data at any time via the app or by emailing clinical@flowen.digital</DocLI>
        <DocLI>A Data Processing Agreement (DPA) governs the relationship between Flowen and your organisation</DocLI>
      </DocUL>
      <DocP>
        You are responsible for recording Flowen as a data processor in your organisation's Record of Processing Activities (ROPA). Your DPO can obtain a copy of the Flowen DPA and DPIA on request.
      </DocP>

      {/* ── 9. Escalation ── */}
      <DocH2 id="support">9. Escalation & Support</DocH2>
      <DocTable
        headers={['Issue type', 'Contact', 'Response time']}
        rows={[
          ['Clinical query / governance question', 'clinical@flowen.digital', 'Within 2 working days'],
          ['Platform technical issue', 'clinical@flowen.digital (mark subject: TECH)', 'Within 1 working day'],
          ['Patient safeguarding concern', 'Your organisation\'s safeguarding lead first; then clinical@flowen.digital', 'Immediate (safeguarding lead) / same day (Flowen)'],
          ['Data subject request (export / deletion)', 'clinical@flowen.digital', 'Within 30 days per UK GDPR Article 12'],
          ['Serious adverse event', 'MHRA Yellow Card + clinical@flowen.digital', 'Immediately'],
        ]}
      />
      <DocCallout variant="tip">
        <DocP>
          Flowen's clinical team is available Monday–Friday, 09:00–17:00 GMT. Out-of-hours urgent patient welfare concerns should be escalated via your organisation's own out-of-hours procedures — Flowen does not provide 24/7 clinical cover.
        </DocP>
      </DocCallout>

    </DocPageLayout>
  );
}
