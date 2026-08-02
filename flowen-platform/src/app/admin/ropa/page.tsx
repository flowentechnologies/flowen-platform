import { assertAdmin } from '@/lib/admin/guard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GDPR Article 30 ROPA — Flowen Admin',
};

const EFFECTIVE_DATE = '1 August 2026';
const COMPANY = 'Flowen Technologies Ltd';
const DPO_EMAIL = 'flowenspeech@outlook.com';

interface ProcessingActivity {
  id: string;
  name: string;
  purpose: string;
  lawfulBasis: string[];
  specialCategoryBasis?: string;
  dataCategories: string[];
  dataSubjects: string[];
  recipients: string[];
  transfers: string;
  retention: string;
  securityMeasures: string;
}

const ACTIVITIES: ProcessingActivity[] = [
  {
    id: 'PA-001',
    name: 'User Account Management',
    purpose: 'Creating and managing user accounts for the Flowen platform; verifying identity; enabling login and access control.',
    lawfulBasis: ['Article 6(1)(b) — Contractual necessity'],
    dataCategories: ['Name', 'Email address', 'Role', 'Account creation date', 'Login timestamps', 'Password hash (via Supabase Auth)'],
    dataSubjects: ['Platform users (patients, clinicians, researchers)'],
    recipients: ['Supabase Inc. (authentication infrastructure, UK-GBR data centres)'],
    transfers: 'Supabase processes authentication in the UK; no EEA/international transfer of auth data.',
    retention: 'Duration of account. Deleted within 30 days of account closure.',
    securityMeasures: 'JWT authentication; bcrypt password hashing; TLS 1.3; RLS policies; Supabase Auth security controls.',
  },
  {
    id: 'PA-002',
    name: 'Clinical Speech Practice Sessions',
    purpose: 'Recording speech practice session metadata (duration, stage, blocks detected) to enable biofeedback, progress tracking, and clinical review.',
    lawfulBasis: ['Article 6(1)(b) — Contractual necessity'],
    specialCategoryBasis: 'Article 9(2)(a) — Explicit consent (health data)',
    dataCategories: [
      'Session duration (seconds)',
      'Total blocks detected (integer count)',
      'Blocks per minute (BPM)',
      'Practice stage identifier',
      'Session timestamp',
      'Self-reported fluency rating (optional)',
      'Session notes (optional, patient-entered)',
    ],
    dataSubjects: ['Patient users (persons who stammer)'],
    recipients: [
      'Supabase Inc. (database storage, UK-GBR)',
      'Assigned SLP clinician (via clinician dashboard — clinical professional)',
    ],
    transfers: 'Data stored in UK data centres only. No international transfer.',
    retention: '90 days from session date (default; configurable by user or SLP). Deleted on account erasure.',
    securityMeasures: 'AES-256-GCM at rest; TLS 1.3 in transit; Row-level security (user can only read own sessions); no raw audio stored.',
  },
  {
    id: 'PA-003',
    name: 'Acoustic Biomarker Processing',
    purpose: 'Processing voice-derived acoustic metrics (RMS, LTI, fundamental frequency) in real-time to provide biofeedback during practice sessions.',
    lawfulBasis: ['Article 6(1)(b) — Contractual necessity'],
    specialCategoryBasis: 'Article 9(2)(a) — Explicit consent (biometric/health data)',
    dataCategories: [
      'Root mean square amplitude (RMS) — per session aggregate',
      'Long-term average spectrum (LTI) — per session aggregate',
      'Fundamental frequency (F0) — per session aggregate',
    ],
    dataSubjects: ['Patient users'],
    recipients: ['Supabase Inc. (aggregated metrics stored in UK-GBR)'],
    transfers: 'Raw audio never transmitted or stored. Aggregated numerical metrics stored in UK only.',
    retention: 'Same as session data (PA-002). 90 days default.',
    securityMeasures: 'On-device audio processing only (Web Audio API). No raw audio storage. Aggregated values only persisted.',
  },
  {
    id: 'PA-004',
    name: 'Clinical Treatment Plan Management',
    purpose: 'Storing and managing therapy treatment plans created by SLPs for assigned patients, including prescribed stages, session targets, and clinical goals.',
    lawfulBasis: ['Article 6(1)(b) — Contractual necessity (clinical service delivery)'],
    specialCategoryBasis: 'Article 9(2)(a) — Explicit consent; Article 9(2)(h) — Health care treatment',
    dataCategories: [
      'Prescribed programme stages',
      'Sessions per week target',
      'Minutes per session target',
      'Programme phase',
      'Clinical goals (free text, SLP-entered)',
      'SLP user ID and display name',
      'Patient user ID',
    ],
    dataSubjects: ['Patient users', 'Clinician users (SLPs)'],
    recipients: [
      'Supabase Inc. (database storage, UK-GBR)',
      'Assigned patient (read access to own plan)',
      'Assigned SLP (full access)',
    ],
    transfers: 'UK data centres only.',
    retention: 'Duration of clinical relationship + 7 years (NHS Records Management Code of Practice standard for clinical records).',
    securityMeasures: 'RLS policies enforce patient/SLP access boundary. Service-role access only for privileged server operations.',
  },
  {
    id: 'PA-005',
    name: 'Clinical Messaging (SLP–Patient)',
    purpose: 'Enabling secure messaging between patients and their assigned Speech & Language Pathologists for clinical communication.',
    lawfulBasis: ['Article 6(1)(b) — Contractual necessity'],
    specialCategoryBasis: 'Article 9(2)(h) — Health care treatment (messages may contain clinical content)',
    dataCategories: [
      'Message content (free text)',
      'Sender and recipient user IDs',
      'Message timestamp',
      'Read status',
    ],
    dataSubjects: ['Patient users', 'Clinician users (SLPs)'],
    recipients: ['Supabase Inc. (database storage, UK-GBR)', 'Message participants only (RLS enforced)'],
    transfers: 'UK data centres only.',
    retention: 'Duration of clinical relationship. Deleted on account erasure (subject to clinical record retention obligations).',
    securityMeasures: 'RLS ensures only the SLP–patient dyad can read messages. Assignment verification on every request. UUID validation.',
  },
  {
    id: 'PA-006',
    name: 'Subscription and Payment Processing',
    purpose: 'Managing user subscriptions, processing payments via Stripe, and maintaining financial records for HMRC compliance.',
    lawfulBasis: ['Article 6(1)(b) — Contractual necessity', 'Article 6(1)(c) — Legal obligation (HMRC)'],
    dataCategories: [
      'Stripe Customer ID (reference token, not card data)',
      'Subscription plan and status',
      'Payment history',
      'Invoice records',
      'Email (for receipt)',
    ],
    dataSubjects: ['Subscribing users'],
    recipients: [
      'Stripe Inc. (independent data controller for payment processing; PCI DSS Level 1 compliant)',
      'HMRC (where legally required)',
    ],
    transfers: 'Stripe processes payments under its own privacy policy. UK–US Data Bridge applies for US processing.',
    retention: '7 years from transaction date (HMRC requirement). Stripe Customer ID retained until subscription cancelled.',
    securityMeasures: 'No raw card data stored by Flowen. Stripe tokenisation. TLS 1.3 for all payment communications.',
  },
  {
    id: 'PA-007',
    name: 'Consent Audit Logging',
    purpose: 'Maintaining an immutable record of all consent grants, withdrawals, and data subject rights requests to demonstrate compliance with UK GDPR.',
    lawfulBasis: ['Article 6(1)(c) — Legal obligation (UK GDPR accountability principle)'],
    dataCategories: [
      'User ID',
      'Event type (consent_granted, consent_withdrawn, erasure_requested, etc.)',
      'Timestamp',
      'Metadata (IP address, consent type, affected data)',
    ],
    dataSubjects: ['All platform users'],
    recipients: ['Supabase Inc. (append-only table, UK-GBR)'],
    transfers: 'UK data centres only.',
    retention: 'Permanent (required for accountability under UK GDPR Article 5(2)). Cannot be deleted.',
    securityMeasures: 'Append-only table (no UPDATE/DELETE permissions via RLS). Immutable audit trail.',
  },
  {
    id: 'PA-008',
    name: 'GDPR Data Erasure Pipeline',
    purpose: 'Processing data subject erasure requests (right to erasure, Article 17), anonymising PII, and recording completion for compliance.',
    lawfulBasis: ['Article 6(1)(c) — Legal obligation (UK GDPR Article 17)'],
    dataCategories: [
      'All personal data fields for the requesting user (read for erasure)',
      'Erasure completion timestamp',
      'Audit log entry',
    ],
    dataSubjects: ['Requesting data subjects'],
    recipients: ['Supabase Inc. (apply_gdpr_erasure() function executes server-side in UK-GBR)'],
    transfers: 'UK data centres only.',
    retention: 'Erasure completion record retained 7 years (legal compliance evidence).',
    securityMeasures: 'Service-role function; admin authentication required to trigger. Consent audit log updated on completion.',
  },
  {
    id: 'PA-009',
    name: 'Waitlist and Invitation Management',
    purpose: 'Managing pre-launch waitlist signups, sending invitation emails, and tracking invitation acceptance for controlled platform onboarding.',
    lawfulBasis: ['Article 6(1)(a) — Consent (waitlist signup)', 'Article 6(1)(b) — Contract (invitation acceptance)'],
    dataCategories: [
      'Email address',
      'Waitlist signup timestamp',
      'Referral source',
      'Invite token (hashed)',
      'Invite expiry date',
      'Conversion timestamp',
    ],
    dataSubjects: ['Waitlist registrants'],
    recipients: ['Supabase Inc. (database, UK-GBR)', 'Email service provider (for invitation dispatch)'],
    transfers: 'UK-GBR storage. Email provider may transfer internationally under SCCs.',
    retention: 'Until invitation accepted and converted to account; or 12 months from waitlist signup if no conversion. Deleted on GDPR erasure request.',
    securityMeasures: 'Invite tokens are unique, single-use, time-limited. Atomic claim prevents TOCTOU duplicate use.',
  },
  {
    id: 'PA-010',
    name: 'Error Monitoring and Logging',
    purpose: 'Monitoring application errors and exceptions to identify and fix bugs, maintain platform reliability, and diagnose security incidents.',
    lawfulBasis: ['Article 6(1)(f) — Legitimate interests (platform security and reliability)'],
    dataCategories: [
      'Anonymised error stack traces',
      'Browser type and version',
      'Page URL at time of error',
      'Session/request identifiers (anonymised)',
    ],
    dataSubjects: ['Platform users (anonymised — PHI masking applied)'],
    recipients: ['Functional Software Inc. / Sentry (error monitoring; EU/US, SCCs + UK Addendum)'],
    transfers: 'Data may be processed in US under Sentry\'s EU–US SCCs. maskAllText and blockAllMedia enabled — no PHI captured.',
    retention: '90 days (Sentry default retention period).',
    securityMeasures: 'Sentry configured with maskAllText: true, blockAllMedia: true. No names, emails, clinical data, or voice data in error payloads.',
  },
  {
    id: 'PA-011',
    name: 'Platform Analytics',
    purpose: 'Aggregated, anonymised usage analytics to understand feature adoption, identify usability issues, and improve the platform.',
    lawfulBasis: ['Article 6(1)(f) — Legitimate interests (product improvement)'],
    dataCategories: [
      'Page views (anonymised)',
      'Feature usage events (anonymised)',
      'Session duration (aggregate)',
    ],
    dataSubjects: ['Platform users (anonymised)'],
    recipients: ['Vercel Analytics (UK/EU infrastructure)'],
    transfers: 'Vercel processes analytics in EU regions under SCCs.',
    retention: '90 days rolling.',
    securityMeasures: 'No cross-site tracking. No advertising identifiers. No PHI in analytics events.',
  },
];

export default async function ROPAPage() {
  await assertAdmin();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Article 30 ROPA</h1>
          <p className="text-slate-400 text-sm mt-1">
            Records of Processing Activities — {COMPANY} — Effective {EFFECTIVE_DATE}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            UK GDPR ART. 30
          </span>
          <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-700/60 text-slate-400 border border-slate-600/50">
            INTERNAL
          </span>
        </div>
      </div>

      {/* Controller details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-4">
          Controller Details
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            { term: 'Data Controller', def: COMPANY },
            { term: 'Registered Address', def: 'London, United Kingdom' },
            { term: 'DPO / Data Protection Contact', def: DPO_EMAIL },
            { term: 'ICO Registration', def: 'Pending — file before processing NHS data' },
            { term: 'Document Version', def: '1.0' },
            { term: 'Last Reviewed', def: EFFECTIVE_DATE },
            { term: 'Next Review Due', def: '1 August 2027' },
            { term: 'Processing Activities', def: String(ACTIVITIES.length) },
          ].map(row => (
            <div key={row.term}>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{row.term}</dt>
              <dd className="text-slate-200 mt-1 font-mono text-xs">{row.def}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Processing Activities', value: ACTIVITIES.length, color: 'text-white' },
          { label: 'Special Category', value: ACTIVITIES.filter(a => a.specialCategoryBasis).length, color: 'text-purple-400' },
          { label: 'International Transfers', value: ACTIVITIES.filter(a => a.transfers.includes('US') || a.transfers.includes('international')).length, color: 'text-amber-400' },
          { label: 'Legitimate Interests', value: ACTIVITIES.filter(a => a.lawfulBasis.some(b => b.includes('6(1)(f)'))).length, color: 'text-sky-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs font-mono text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Activities */}
      <div className="space-y-4">
        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 pb-3 border-b border-slate-800">
          Processing Activities Register
        </h2>
        {ACTIVITIES.map(activity => (
          <details key={activity.id} className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <summary className="flex items-start gap-4 p-5 cursor-pointer list-none hover:bg-slate-800/40 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {activity.id}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">{activity.name}</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed line-clamp-2 group-open:line-clamp-none">
                  {activity.purpose}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {activity.lawfulBasis.map(b => (
                    <span key={b} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {b.split('—')[0].trim()}
                    </span>
                  ))}
                  {activity.specialCategoryBasis && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      Art. 9 — Special Category
                    </span>
                  )}
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </summary>

            <div className="px-5 pb-5 border-t border-slate-800">
              <dl className="mt-4 space-y-4">
                {[
                  { term: 'Purpose', def: activity.purpose },
                  { term: 'Lawful Basis (Art. 6)', def: activity.lawfulBasis.join('; ') },
                  ...(activity.specialCategoryBasis ? [{ term: 'Special Category Basis (Art. 9)', def: activity.specialCategoryBasis }] : []),
                  { term: 'Data Categories', def: activity.dataCategories.join(', ') },
                  { term: 'Data Subjects', def: activity.dataSubjects.join('; ') },
                  { term: 'Recipients / Sub-processors', def: activity.recipients.join('; ') },
                  { term: 'International Transfers', def: activity.transfers },
                  { term: 'Retention Period', def: activity.retention },
                  { term: 'Technical & Organisational Measures', def: activity.securityMeasures },
                ].map(row => (
                  <div key={row.term} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider sm:col-span-1">
                      {row.term}
                    </dt>
                    <dd className="text-slate-300 text-xs leading-relaxed sm:col-span-2">
                      {row.def}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </details>
        ))}
      </div>

      {/* Footer */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 text-xs text-slate-500 space-y-2">
        <p>
          <strong className="text-slate-300">Document owner:</strong> {DPO_EMAIL} · Review annually or upon material change to processing activities.
        </p>
        <p>
          This register covers {COMPANY} as Data Controller. Sub-processor DPAs are maintained separately. Third parties operating as independent controllers (e.g. Stripe) are not included in this register.
        </p>
        <p>
          <strong className="text-slate-300">ICO registration:</strong> Required before handling any NHS patient data. Register at ico.org.uk/registration under Schedule 1, Part 2 (health data processing). Fee: £40–£2,900/year based on size.
        </p>
      </div>
    </div>
  );
}
