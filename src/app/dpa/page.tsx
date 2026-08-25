import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Processing Agreement — Flowen Speech Platform',
  description: 'Flowen\'s standard Data Processing Agreement for NHS trusts, ICBs, private clinics, and institutional customers under UK GDPR Article 28.',
};

const CLAUSES = [
  {
    number: '1',
    title: 'Definitions',
    content: `In this Agreement:

"Controller" means the organisation (NHS trust, ICB, private clinic, educational institution, or other body) contracting with Flowen Technologies Ltd for access to the Flowen Platform.

"Processor" means Flowen Technologies Ltd, a company registered in England and Wales, operating the Flowen speech fluency platform at flowen.digital.

"Data Subject" means the individual (typically a patient or platform user) whose personal data is processed.

"Personal Data", "Special Category Data", "Processing", "Data Breach", "Supervisory Authority", and other terms have the meanings given in the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018 (DPA 2018).

"Sub-processor" means any third party engaged by Flowen Technologies Ltd to process Personal Data on behalf of the Controller.

"Services" means the Flowen speech fluency platform and associated clinical management tools provided under the commercial agreement between the parties.`,
  },
  {
    number: '2',
    title: 'Subject Matter, Duration, Nature & Purpose',
    content: `2.1 SUBJECT MATTER
This Agreement governs the processing of Personal Data by the Processor on behalf of the Controller in connection with the provision of the Services.

2.2 DURATION
This Agreement is effective from the date the Controller first accesses the Services and remains in force for the duration of the commercial agreement between the parties, including any run-off period required to complete residual processing obligations.

2.3 NATURE OF PROCESSING
The Processor will process Personal Data to: (a) deliver platform access and speech practice sessions; (b) facilitate clinical oversight between assigned SLPs and patients; (c) generate therapy progress reports; (d) maintain session records and audit trails; (e) provide technical support.

2.4 PURPOSE OF PROCESSING
Processing is carried out for the purpose of delivering speech fluency support and clinical workflow management as described in the commercial agreement.

2.5 TYPES OF PERSONAL DATA
— Identity data: name, email address, role
— Special category health data: speech fluency metrics, acoustic biomarkers, therapy progression data
— Clinical data: treatment plans, session notes, clinician observations

2.6 CATEGORIES OF DATA SUBJECTS
Patient users (persons who stammer) and clinician users (SLPs and other healthcare professionals) within the Controller's organisation or patient population.`,
  },
  {
    number: '3',
    title: 'Controller Obligations',
    content: `3.1 The Controller warrants that it has a valid lawful basis under UK GDPR Article 6 and, where applicable, Article 9(2) for each purpose for which it instructs the Processor to process Personal Data.

3.2 The Controller is responsible for obtaining all necessary consents from Data Subjects and providing appropriate transparency information (privacy notices) to Data Subjects about the use of the Flowen Platform before data is entered into the system.

3.3 The Controller shall provide complete and accurate instructions to the Processor and shall not instruct the Processor to process Personal Data in a manner that would cause the Processor to violate applicable data protection law.

3.4 The Controller is responsible for assessing and documenting the legal basis for processing under their own data protection obligations, including maintaining their own Article 30 Records of Processing Activities.`,
  },
  {
    number: '4',
    title: 'Processor Obligations',
    content: `4.1 INSTRUCTIONS
The Processor shall process Personal Data only on the documented instructions of the Controller and for no other purpose, except where required to do so by UK law. If required to process for another purpose by law, the Processor will notify the Controller before processing (unless prohibited by law).

4.2 CONFIDENTIALITY
The Processor shall ensure that all personnel authorised to process Personal Data are under appropriate confidentiality obligations, whether contractual or statutory.

4.3 SECURITY
The Processor shall implement and maintain appropriate technical and organisational measures to protect Personal Data against unauthorised or unlawful processing and against accidental loss, destruction, damage, alteration, or disclosure. Current measures include: AES-256-GCM encryption at rest; TLS 1.3 in transit; PostgreSQL row-level security; JWT authentication; no raw audio storage; PHI-masked error monitoring; UK data residency.

4.4 SUB-PROCESSORS
The Processor is authorised to engage sub-processors to assist in delivering the Services, subject to the provisions of Clause 5 below.

4.5 DATA SUBJECT RIGHTS
The Processor shall promptly notify the Controller (within 3 business days) upon receiving a Data Subject request relating to data processed on behalf of the Controller, and shall provide reasonable assistance to enable the Controller to fulfil its obligations to respond.

4.6 DATA PROTECTION IMPACT ASSESSMENTS
The Processor shall provide reasonable assistance to the Controller in conducting Data Protection Impact Assessments (DPIAs) where required under UK GDPR Article 35, including providing information about processing activities and security measures.

4.7 DELETION OR RETURN
Upon termination of the commercial agreement, the Processor shall, at the Controller's election, either securely delete or return all Personal Data (and copies thereof), unless retention is required by UK law. The Processor will confirm completion within 30 days of termination.

4.8 AUDIT & INFORMATION
The Processor shall provide the Controller with all information necessary to demonstrate compliance with this Agreement. The Processor shall allow for and contribute to audits conducted by the Controller or its authorised auditor, on reasonable notice (not less than 14 days), during normal business hours, subject to appropriate confidentiality undertakings. The Processor may charge a reasonable fee for audit assistance beyond routine documentation provision.`,
  },
  {
    number: '5',
    title: 'Sub-processors',
    content: `5.1 CURRENT SUB-PROCESSORS
The Controller consents to the engagement of the following sub-processors:

— Supabase Inc.: database infrastructure and authentication (UK-GBR data centres)
— Vercel Inc.: cloud hosting and edge functions (UK/EU regions)
— Agora Inc.: real-time voice processing for AI speech coach sessions (live audio streamed in-session only; no persistent audio storage by Agora)
— Functional Software Inc. (Sentry): anonymised error monitoring (PHI masking enabled)
— Stripe Inc.: payment processing (operates as independent data controller for payment data)

A current, complete list of sub-processors is maintained at flowen.digital/dpa and updated upon any change.

5.2 NEW SUB-PROCESSORS
The Processor shall give the Controller at least 30 days' written notice before adding or replacing a sub-processor. The Controller may object to a new sub-processor within this period on reasonable data protection grounds. If the parties cannot resolve the objection, either party may terminate the commercial agreement on written notice without penalty.

5.3 FLOW-DOWN OBLIGATIONS
The Processor shall impose equivalent data protection obligations on each sub-processor by way of a written contract, including all obligations set out in this Agreement. The Processor remains fully liable to the Controller for any failure by a sub-processor to fulfil its data protection obligations.`,
  },
  {
    number: '6',
    title: 'International Transfers',
    content: `6.1 Personal Data shall be stored in UK data centres.

6.2 Where processing by a sub-processor involves transfer to a country outside the UK, the Processor shall ensure an appropriate safeguard is in place as required by UK GDPR Chapter V, including: UK adequacy regulations, Standard Contractual Clauses (SCCs) with UK Addendum, or the UK International Data Transfer Agreement (IDTA).

6.3 The Processor will notify the Controller of any planned international transfers prior to their implementation and provide evidence of the applicable safeguard on request.`,
  },
  {
    number: '7',
    title: 'Personal Data Breaches',
    content: `7.1 The Processor shall notify the Controller without undue delay, and in any event within 72 hours of becoming aware of a Personal Data Breach involving data processed on behalf of the Controller.

7.2 The notification shall include, to the extent then known: (a) a description of the nature of the breach; (b) the categories and approximate number of Data Subjects affected; (c) the categories and approximate number of Personal Data records affected; (d) the likely consequences of the breach; (e) the measures taken or proposed to address the breach and mitigate its effects.

7.3 The Processor shall cooperate with and provide reasonable assistance to the Controller in any notification to the ICO or Data Subjects required under UK GDPR Articles 33 and 34.`,
  },
  {
    number: '8',
    title: 'Clinical Safety',
    content: `8.1 The Processor operates under the NHS DCB0129 Clinical Safety Standard. The Processor's Clinical Safety Case Report and Hazard Log are available to the Controller upon request.

8.2 The Controller's clinical staff must receive appropriate training before using the Platform in a clinical context. The Processor will provide training materials and, where agreed, remote training sessions.

8.3 The Controller is responsible for DCB0160 (Deployment Clinical Safety) compliance within its own organisation, including appointing a Deployment Clinical Safety Officer.

8.4 Clinical safety incidents or near-misses must be reported to the Processor at hello@flowen.digital with the subject [CLINICAL SAFETY INCIDENT].`,
  },
  {
    number: '9',
    title: 'Liability',
    content: `9.1 Each party's liability to the other under or in connection with this Agreement is subject to the limitations and exclusions in the commercial agreement between the parties.

9.2 The Processor's liability under this Agreement shall not exceed the greater of: (a) the total fees paid by the Controller to the Processor in the 12 months preceding the claim; or (b) £50,000.

9.3 Neither party shall be liable for indirect, consequential, or punitive damages.

9.4 Nothing in this Agreement excludes liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded under English law.`,
  },
  {
    number: '10',
    title: 'Governing Law',
    content: `This Agreement is governed by the laws of England and Wales. Any disputes arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
  },
];

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          UK GDPR ARTICLE 28
        </span>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">
          Data Processing Agreement
        </h1>
        <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-2xl">
          Standard Data Processing Agreement (DPA) between Flowen Technologies Ltd (Processor) and NHS trusts,
          ICBs, private clinics, and institutional customers (Controller). Effective 1 August 2026.
        </p>

        {/* Key facts */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Standard', value: 'UK GDPR Art. 28' },
            { label: 'Data Residency', value: 'UK-GBR' },
            { label: 'Breach Notice', value: '72 hours' },
            { label: 'Deletion', value: '30 days' },
          ].map(b => (
            <div key={b.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <div className="text-base font-black text-emerald-400 font-mono">{b.value}</div>
              <div className="text-xs text-slate-500 mt-1">{b.label}</div>
            </div>
          ))}
        </div>

        {/* Preamble */}
        <div className="mt-10 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-300 text-sm leading-relaxed">
            This Data Processing Agreement (&quot;Agreement&quot;) supplements the commercial agreement between Flowen
            Technologies Ltd and the Controller organisation. Where any inconsistency exists between this Agreement
            and the commercial agreement in respect of data protection obligations, this Agreement shall prevail.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mt-3">
            For NHS organisations, this Agreement is designed to be consistent with NHS standard data sharing
            terms and the NHS Data Security and Protection Toolkit requirements. For bespoke terms or to request
            a signed DPA, contact{' '}
            <a href="mailto:hello@flowen.digital" className="text-emerald-400 hover:underline">
              hello@flowen.digital
            </a>.
          </p>
        </div>

        {/* Clauses */}
        <div className="mt-8 space-y-4">
          {CLAUSES.map(clause => (
            <details key={clause.number} className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none hover:bg-slate-800/40 transition-colors">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                    CLAUSE {clause.number}
                  </span>
                  <h2 className="text-base font-bold text-white mt-1">{clause.title}</h2>
                </div>
                <svg
                  className="w-5 h-5 text-slate-500 flex-shrink-0 ml-4 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <div className="px-6 pb-6 border-t border-slate-800">
                <pre className="mt-4 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap font-sans">
                  {clause.content}
                </pre>
              </div>
            </details>
          ))}
        </div>

        {/* Sub-processor list */}
        <div className="mt-10">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800">
            Current Sub-processor Register
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Sub-processor</th>
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Purpose</th>
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Location</th>
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Safeguard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {[
                  { name: 'Supabase Inc.', purpose: 'Database, auth, storage', location: 'UK-GBR', safeguard: 'SCCs + UK Addendum' },
                  { name: 'Vercel Inc.', purpose: 'Hosting, edge functions', location: 'UK/EU', safeguard: 'SCCs + UK Addendum' },
                  { name: 'Agora Inc.', purpose: 'Real-time voice (AI speech coach sessions — live audio only, not stored)', location: 'US/EU', safeguard: 'SCCs + UK Addendum' },
                  { name: 'Functional Software Inc. (Sentry)', purpose: 'Error monitoring (PHI masked)', location: 'EU/US', safeguard: 'SCCs + UK Addendum' },
                  { name: 'Stripe Inc.', purpose: 'Payment processing', location: 'US/EU', safeguard: 'Independent controller; UK–US Data Bridge' },
                ].map(sp => (
                  <tr key={sp.name} className="bg-slate-900/30 hover:bg-slate-900/60 transition-colors">
                    <td className="p-4 text-white font-medium">{sp.name}</td>
                    <td className="p-4 text-slate-400">{sp.purpose}</td>
                    <td className="p-4 text-slate-400 font-mono text-xs">{sp.location}</td>
                    <td className="p-4 text-slate-400 text-xs">{sp.safeguard}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            Last updated: 1 August 2026. Changes to sub-processors are notified with 30 days&apos; notice.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-white font-bold text-base mb-2">Request a Signed DPA</h3>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            NHS trusts, ICBs, and institutional customers can request a fully executed, signed DPA — including
            organisation-specific schedules and any required NHS standard terms — by contacting our team.
          </p>
          <a
            href="mailto:hello@flowen.digital?subject=DPA Request — [Organisation Name]"
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            Request DPA →
          </a>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
