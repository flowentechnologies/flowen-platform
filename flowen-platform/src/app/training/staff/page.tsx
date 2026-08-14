import type { Metadata } from 'next';
import { assertAdmin } from '@/lib/admin/guard';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable, type TocEntry,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'Flowen Staff Training Manual — Flowen',
  description:
    'Internal training manual for Flowen staff covering platform architecture, admin portal, user management, data handling, clinical safety obligations, and acceptable use policy.',
};

const TOC: TocEntry[] = [
  { id: 'overview', label: '1. Overview & Scope' },
  { id: 'architecture', label: '2. Platform Architecture' },
  { id: 'admin-portal', label: '3. Admin Portal', sub: [
    { id: 'user-management', label: 'User management' },
    { id: 'organisations', label: 'Organisation management' },
    { id: 'content', label: 'Content & exercises' },
    { id: 'flags', label: 'Safety flag dashboard' },
  ]},
  { id: 'data', label: '4. Data Handling' },
  { id: 'clinical-safety', label: '5. Clinical Safety Obligations' },
  { id: 'incident-response', label: '6. Incident Response' },
  { id: 'aup', label: '7. Acceptable Use Policy' },
  { id: 'access-control', label: '8. Access Control & Offboarding' },
  { id: 'contacts', label: '9. Key Contacts' },
];

export default async function StaffTrainingPage() {
  await assertAdmin();

  return (
    <DocPageLayout
      tag="INTERNAL"
      tagColor="violet"
      title="Flowen Staff Training Manual"
      subtitle="Internal documentation for Flowen staff covering the platform stack, admin tooling, data handling obligations, clinical safety duties, and acceptable use policy. Read this before being granted admin access."
      date="August 2026"
      readTime="35 min"
      toc={TOC}
      parentLabel="Training"
      parentHref="/training"
    >

      {/* ── 1. Overview ── */}
      <DocH2 id="overview">1. Overview & Scope</DocH2>
      <DocP>
        This manual applies to all Flowen Speech Technology Ltd employees, contractors, and third-party agents who are granted access to the Flowen admin portal, production database, or any system that processes patient or clinician data.
      </DocP>
      <DocP>
        Flowen processes Special Category data (health data) under UK GDPR Article 9. All staff with data access are bound by data handling obligations regardless of role. Failure to comply with this manual may result in disciplinary action, termination of access, or referral to the ICO.
      </DocP>
      <DocCallout variant="warning">
        <DocP>
          <strong className="text-slate-200">This is a confidential internal document.</strong> Do not share, screenshot, or forward outside the organisation. Do not paste contents into AI assistants or collaboration tools without prior approval from the CTO.
        </DocP>
      </DocCallout>

      {/* ── 2. Architecture ── */}
      <DocH2 id="architecture">2. Platform Architecture</DocH2>
      <DocP>
        Flowen is built on a Next.js application (App Router) deployed on Vercel, backed by a Supabase PostgreSQL database. The mobile app is a React Native application. Key components:
      </DocP>
      <DocTable
        headers={['Component', 'Technology', 'Access']}
        rows={[
          ['Web app (patient + SLT portal)', 'Next.js 15 on Vercel', 'Vercel dashboard — engineering team only'],
          ['Mobile app', 'React Native (iOS + Android)', 'App Store Connect + Google Play Console — engineering only'],
          ['Database', 'Supabase PostgreSQL (UK region)', 'Supabase dashboard — CTO + Senior Engineers only'],
          ['Authentication', 'Supabase Auth (email/password + MFA)', 'Via Supabase dashboard'],
          ['File storage', 'Supabase Storage', 'Via Supabase dashboard — not used for patient audio'],
          ['Email delivery', 'Resend (transactional)', 'Resend dashboard — CTO + Head of Product only'],
          ['Analytics', 'PostHog (EU-hosted)', 'PostHog dashboard — all staff with business justification'],
          ['Error tracking', 'PostHog error tracking', 'PostHog dashboard — engineering team'],
          ['ASR engine', 'Self-hosted model on Flowen inference server', 'Requires VPN + SSH key — engineering only'],
        ]}
      />
      <DocH3>Environment separation</DocH3>
      <DocUL>
        <DocLI><strong className="text-slate-300">Production (flowen.digital):</strong> Live patient data — access requires explicit approval from CTO for each individual. Production access must be logged.</DocLI>
        <DocLI><strong className="text-slate-300">Staging (staging.flowen.digital):</strong> Anonymised or synthetic data only. Engineers use this for testing and QA. Never put real patient data in staging.</DocLI>
        <DocLI><strong className="text-slate-300">Local development:</strong> Local Supabase stack with synthetic data. Never connect a local dev environment to the production database.</DocLI>
      </DocUL>

      {/* ── 3. Admin Portal ── */}
      <DocH2 id="admin-portal">3. Admin Portal</DocH2>
      <DocP>
        The admin portal is available at <strong className="text-slate-300">flowen.digital/admin</strong>. Access requires a Flowen staff account with an <code className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs">admin</code> or <code className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded text-xs">super_admin</code> role, plus MFA. Accounts are provisioned by the CTO. Do not attempt to access the admin portal without explicit provisioning.
      </DocP>

      <DocH3 id="user-management">User management</DocH3>
      <DocP>
        The Users section lists all registered accounts (patients and SLTs) across all organisations. You can:
      </DocP>
      <DocUL>
        <DocLI>Search by email, name, or organisation</DocLI>
        <DocLI>View account status (active, pending, archived)</DocLI>
        <DocLI>Reset a user's MFA (requires logging the reason in the action notes field — mandatory)</DocLI>
        <DocLI>Suspend an account (immediately prevents login; does not delete data)</DocLI>
        <DocLI>Export a user's data in response to a Subject Access Request (see Section 4)</DocLI>
      </DocUL>
      <DocCallout variant="warning">
        <DocP>
          <strong className="text-slate-200">Never look up patient data without a documented reason.</strong> Every admin action on patient accounts is audit-logged. Accessing patient data out of curiosity, for personal reasons, or at the request of someone outside the authorised clinical team is a data protection breach.
        </DocP>
      </DocCallout>

      <DocH3 id="organisations">Organisation management</DocH3>
      <DocP>
        The Organisations section manages NHS Trusts, PCNs, private practices, and other entities that have signed a contract with Flowen. Each organisation has:
      </DocP>
      <DocUL>
        <DocLI>A unique organisation ID and name</DocLI>
        <DocLI>A contract status (trial, active, suspended, churned)</DocLI>
        <DocLI>An assigned Flowen account manager (internal staff member)</DocLI>
        <DocLI>A list of SLT portal users belonging to that organisation</DocLI>
        <DocLI>A licence count (number of active patient enrolments permitted)</DocLI>
      </DocUL>
      <DocP>
        Only the CTO or Head of Product may change contract status or licence counts. Engineering staff with admin access may view organisation settings for support purposes.
      </DocP>

      <DocH3 id="content">Content & exercises</DocH3>
      <DocP>
        The Content section manages the exercise library available to SLTs when building programmes. Adding, editing, or removing exercises requires clinical review and sign-off from the designated Clinical Safety Officer before publishing. Do not make live changes to exercise parameters (duration targets, disfluency thresholds, audio cues) without going through the change management process.
      </DocP>
      <DocCallout variant="info">
        <DocP>
          Exercise changes are Medical Device configuration changes under DCB0129. They must be reviewed by the Clinical Safety Officer and documented in the Hazard Log before deployment.
        </DocP>
      </DocCallout>

      <DocH3 id="flags">Safety flag dashboard</DocH3>
      <DocP>
        The Safety Flags section shows all active clinical safety flags across all organisations. This dashboard is for monitoring and escalation only — do not resolve or dismiss flags on behalf of the responsible SLT. Contact the relevant SLT or Clinical Lead via the organisation's clinical contact and ask them to review the flag in their own portal.
      </DocP>
      <DocP>
        Flags that have been open for more than 5 working days without SLT action should be escalated to Flowen's designated Clinical Safety Officer.
      </DocP>

      {/* ── 4. Data Handling ── */}
      <DocH2 id="data">4. Data Handling</DocH2>
      <DocP>
        Flowen processes the following categories of personal data:
      </DocP>
      <DocTable
        headers={['Data type', 'Category', 'Where stored', 'Staff who may access']}
        rows={[
          ['Patient name, email, DOB', 'Personal data', 'Supabase PostgreSQL', 'CTO, Senior Engineers (production access), customer support (via admin portal, for support cases only)'],
          ['Acoustic telemetry (speaking rate, accuracy scores, session timing)', 'Health data (Special Category)', 'Supabase PostgreSQL', 'CTO, Senior Engineers (production access only)'],
          ['SLT clinical notes', 'Health data (Special Category)', 'Supabase PostgreSQL', 'CTO, Senior Engineers (production access only) — never accessed without express reason'],
          ['Session metadata (date, duration, device)', 'Personal data', 'Supabase PostgreSQL', 'Engineering team (for debugging, with logging)'],
          ['Email addresses (SLTs)', 'Personal data', 'Supabase + Resend', 'CTO, Head of Product'],
          ['Analytics events (anonymised)', 'Non-personal', 'PostHog (EU)', 'All staff'],
        ]}
      />
      <DocH3>Subject Access Requests (SARs)</DocH3>
      <DocP>
        If a patient or SLT submits a SAR (data export or deletion request), it is routed to <strong className="text-slate-300">clinical@flowen.digital</strong> and managed by the Head of Product with CTO sign-off. Engineering support may be required to run the export. All SAR actions must be completed within 30 days and documented in the SAR log.
      </DocP>
      <DocH3>Data minimisation</DocH3>
      <DocP>
        When debugging, use anonymised staging data wherever possible. If you must access production data, log the reason, the records accessed, and the time in the production access log (Notion — Engineering → Production Access Log). Do not download or copy patient data to local machines or personal cloud storage.
      </DocP>

      {/* ── 5. Clinical Safety ── */}
      <DocH2 id="clinical-safety">5. Clinical Safety Obligations</DocH2>
      <DocP>
        Flowen is a Class I Medical Device. All staff — not just clinicians — have obligations under DCB0129 and UK MDR 2002. In practice, this means:
      </DocP>
      <DocUL>
        <DocLI>Any change to software that could affect clinical function (biofeedback thresholds, exercise parameters, safety flag logic, notification delivery) must go through the clinical safety change management process before release</DocLI>
        <DocLI>Suspected adverse events (patient harm or near-miss attributable to the Flowen platform) must be escalated immediately to the Clinical Safety Officer</DocLI>
        <DocLI>The Clinical Safety Case and Hazard Log must be kept current — engineering leads are responsible for updating it after significant software changes</DocLI>
        <DocLI>Post-market surveillance data (error rates, safety flags, adverse events) is reviewed quarterly by the Clinical Safety Officer</DocLI>
      </DocUL>
      <DocCallout variant="warning">
        <DocP>
          <strong className="text-slate-200">Serious adverse events (SAEs).</strong> If you become aware of a serious adverse event — patient harm that may be attributable to Flowen — your immediate obligation is to report it to the Clinical Safety Officer and CTO. Flowen has a 24-hour window to submit a MHRA Yellow Card for SAEs. Do not wait for the weekly standup.
        </DocP>
      </DocCallout>

      {/* ── 6. Incident Response ── */}
      <DocH2 id="incident-response">6. Incident Response</DocH2>
      <DocTable
        headers={['Incident type', 'Immediate action', 'Escalation', 'Timeframe']}
        rows={[
          ['Data breach (suspected or confirmed)', 'Isolate affected system if safe to do so; notify CTO immediately', 'CTO notifies DPO; DPO assesses ICO notification requirement (72-hour window under UK GDPR)', 'Immediately on discovery'],
          ['Platform outage (patient-facing)', 'Notify CTO and Head of Product; post status update to status.flowen.digital', 'CTO activates incident response; customer communications within 30 min for outages >30 min', 'Within 15 minutes'],
          ['Serious adverse event (patient harm)', 'Notify Clinical Safety Officer and CTO verbally; send written summary within 2 hours', 'CSO submits MHRA Yellow Card; head of product notifies affected NHS Clinical Lead', 'Within 24 hours'],
          ['Security incident (unauthorised access)', 'Revoke access immediately; notify CTO; preserve logs', 'CTO reviews; if personal data involved, treat as data breach', 'Immediately'],
          ['Staff data access violation', 'Notify line manager and CTO', 'HR and DPO review; disciplinary process per Flowen HR policy', 'Within 24 hours'],
        ]}
      />
      <DocP>
        All incidents must be logged in the Incident Register (Notion — Operations → Incident Register) within 24 hours, regardless of severity. Near-misses are also logged — there is no threshold below which logging is optional.
      </DocP>

      {/* ── 7. AUP ── */}
      <DocH2 id="aup">7. Acceptable Use Policy</DocH2>
      <DocP>
        All staff with access to Flowen systems must comply with the following:
      </DocP>
      <DocUL>
        <DocLI>Use only your own Flowen-issued credentials. Never share passwords or MFA devices.</DocLI>
        <DocLI>Use a Flowen-managed device or a personally-managed device that meets the BYOD policy (full-disk encryption, up-to-date OS, endpoint protection) when accessing production systems.</DocLI>
        <DocLI>Do not access patient data from public Wi-Fi without a VPN. Use the Flowen VPN for all production access from non-office locations.</DocLI>
        <DocLI>Do not paste patient data or clinical notes into AI assistants (ChatGPT, Claude, Gemini, etc.) without prior written approval from the CTO and a documented data processing basis.</DocLI>
        <DocLI>Do not copy patient data to personal cloud storage (Google Drive, Dropbox, iCloud, etc.).</DocLI>
        <DocLI>Do not install unapproved software on Flowen-managed devices without IT approval.</DocLI>
        <DocLI>Lock your screen when stepping away from your device, even briefly.</DocLI>
        <DocLI>Report any suspected phishing, social engineering attempts, or suspicious account activity to the CTO immediately.</DocLI>
      </DocUL>
      <DocCallout variant="info">
        <DocP>
          <strong className="text-slate-200">AI tools and patient data.</strong> AI productivity tools may be used for non-patient-data tasks (drafting comms, code review, content). They may not be used with identifiable patient data under any circumstances without a documented legal basis and explicit CTO sign-off.
        </DocP>
      </DocCallout>

      {/* ── 8. Access Control ── */}
      <DocH2 id="access-control">8. Access Control & Offboarding</DocH2>
      <DocH3>Provisioning</DocH3>
      <DocP>
        Access to Flowen systems is provisioned on a least-privilege basis. New staff request access via the IT onboarding form. The CTO approves production access; line managers approve staging and analytics access. Access is reviewed quarterly.
      </DocP>
      <DocH3>Offboarding</DocH3>
      <DocP>
        When a staff member leaves, the following steps must be completed by the end of their last working day:
      </DocP>
      <DocUL>
        <DocLI>Flowen SSO / admin account disabled</DocLI>
        <DocLI>Supabase access revoked (if granted)</DocLI>
        <DocLI>Vercel access revoked</DocLI>
        <DocLI>Resend access revoked (if granted)</DocLI>
        <DocLI>PostHog access revoked</DocLI>
        <DocLI>VPN certificate revoked</DocLI>
        <DocLI>GitHub organisation access revoked</DocLI>
        <DocLI>Notion access revoked</DocLI>
        <DocLI>Flowen-managed device collected and wiped</DocLI>
      </DocUL>
      <DocP>
        IT (CTO or delegated engineer) is responsible for completing and logging the offboarding checklist in Notion (HR → Offboarding).
      </DocP>

      {/* ── 9. Contacts ── */}
      <DocH2 id="contacts">9. Key Contacts</DocH2>
      <DocTable
        headers={['Role', 'Responsibility', 'Contact']}
        rows={[
          ['CTO', 'Data security, production access, incident response, AI tool approvals', 'Internal Slack @cto'],
          ['Clinical Safety Officer', 'DCB0129, hazard log, adverse events, clinical governance', 'clinical@flowen.digital'],
          ['Head of Product', 'Admin portal, SARs, customer communications, commissioning', 'Internal Slack @product'],
          ['DPO', 'UK GDPR, DPIA, ICO notifications, data breach assessment', 'Via CTO'],
          ['IT / Engineering Lead', 'Access provisioning, device management, offboarding', 'Internal Slack @engineering'],
        ]}
      />
    </DocPageLayout>
  );
}
