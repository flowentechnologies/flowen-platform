import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'NHS ICB Commissioning Guide — Flowen Resources',
  description: 'Commissioner guide to Flowen\'s NHS readiness: clinical safety preparation, evidence base, data protection, and procurement routes.',
};

const TOC = [
  { id: 'overview',       label: 'Overview' },
  { id: 'dtac',           label: 'DTAC alignment',
    sub: [
      { id: 'dtac-clinical',   label: 'Clinical safety' },
      { id: 'dtac-data',       label: 'Data security' },
      { id: 'dtac-technical',  label: 'Technical assurance' },
      { id: 'dtac-usability',  label: 'Usability & accessibility' },
      { id: 'dtac-interop',    label: 'Interoperability' },
    ],
  },
  { id: 'procurement',    label: 'Procurement routes' },
  { id: 'evidence',       label: 'Evidence base' },
  { id: 'commissioning',  label: 'Commissioning model' },
  { id: 'sla',            label: 'Service level commitments' },
  { id: 'implementation', label: 'Implementation' },
  { id: 'contact',        label: 'Get in touch' },
];

export default function NhsProcurementPage() {
  return (
    <DocPageLayout
      tag="NHS"
      tagColor="cyan"
      title="NHS ICB Commissioning for Fluency Practice Tools"
      subtitle="A commissioner's guide to Flowen and the Digital Technology Assessment Criteria (DTAC). Covers clinical safety preparation, evidence base, data protection, procurement routes, and service commitments."
      date="August 2026"
      readTime="15 min"
      toc={TOC}
    >

      <DocH2 id="overview">Overview</DocH2>
      <DocP>
        Flowen is a real-time acoustic biofeedback platform for people who stammer and others working on speech fluency. It delivers real-time biofeedback and structured practice built on evidence-based techniques used in clinical fluency therapy.
      </DocP>
      <DocP>
        Flowen is being prepared for NHS commissioning. DCB0129 clinical safety documentation is in preparation, DTAC alignment work is under way, and data is hosted in the UK (London) under UK GDPR-compliant controls.
      </DocP>
      <DocCallout variant="info">
        <DocP>Flowen is intended for commissioning by Integrated Care Boards (ICBs), NHS Trusts, Primary Care Networks (PCNs), and talking-therapy services once clinical safety documentation is complete. It is designed to operate as a standalone practice tool or as a supervised adjunct to SLT-led care.</DocP>
      </DocCallout>

      <DocH2 id="dtac">DTAC Alignment</DocH2>
      <DocP>
        The Digital Technology Assessment Criteria (DTAC) is the NHS England framework for assessing digital health tools before procurement. It covers five domains: clinical safety, data protection, technical assurance, usability, and interoperability.
      </DocP>

      <DocH3 id="dtac-clinical">Clinical safety — DCB0129</DocH3>
      <DocP>
        Flowen is preparing its documentation against NHS England's DCB0129 Clinical Safety Standard for health IT systems. The standard mandates:
      </DocP>
      <DocUL>
        <DocLI>Appointment of a Clinical Safety Officer (CSO) with appropriate clinical and technical qualifications</DocLI>
        <DocLI>A Clinical Safety Case Report (CSCR) documenting hazard identification, risk assessment, and mitigations</DocLI>
        <DocLI>A maintained and monitored Hazard Log</DocLI>
        <DocLI>Defined clinical risk management processes</DocLI>
        <DocLI>Incident reporting and response procedures</DocLI>
      </DocUL>
      <DocP>
        Draft documentation (hazard log and initial clinical safety case) is available on request via <strong className="text-slate-200">security@flowen.digital</strong>. Clinical Safety Officer appointment is in progress.
      </DocP>

      <DocH3 id="dtac-data">Data security — UK GDPR &amp; DSP Toolkit</DocH3>
      <DocP>
        Flowen processes personal health data as a data controller (for direct-access users) and data processor (in clinical deployment models). Our data governance framework includes:
      </DocP>
      <DocTable
        headers={['Requirement', 'Flowen position']}
        rows={[
          ['UK GDPR compliance',           'Privacy-by-design architecture; DPA available on request'],
          ['Data Processing Agreement',     'Standard DPA available; NHS-specific DPA on request'],
          ['Data residency',                'All data processed and stored in UK (AWS eu-west-2)'],
          ['Encryption at rest',           'AES-256 on all stored data'],
          ['Encryption in transit',        'TLS 1.3 on all connections'],
          ['DSP Toolkit',                   'Self-assessment planned ahead of NHS deployment'],
          ['Penetration testing',           'Independent penetration testing planned ahead of NHS deployment'],
          ['Retention & deletion',         'Configurable; documented defaults with full deletion on request'],
        ]}
      />
      <DocP>
        A Data Protection Impact Assessment (DPIA) template for NHS deployments is available on request via <strong className="text-slate-200">privacy@flowen.digital</strong>.
      </DocP>

      <DocH3 id="dtac-technical">Technical assurance</DocH3>
      <DocP>Flowen is a cloud-native web application. Key technical specifications:</DocP>
      <DocUL>
        <DocLI>Browser-based — no app store dependency, works on any modern browser including NHS-managed devices</DocLI>
        <DocLI>Hosted on Vercel with a Supabase PostgreSQL database in the UK (London region)</DocLI>
        <DocLI>Automated backups managed by the platform providers</DocLI>
        <DocLI>Continuous dependency scanning and automated security patching</DocLI>
      </DocUL>

      <DocH3 id="dtac-usability">Usability &amp; accessibility</DocH3>
      <DocUL>
        <DocLI>WCAG 2.2 AA targeted (accessibility statement available at flowen.digital/accessibility)</DocLI>
        <DocLI>Mobile and tablet compatible for use across devices</DocLI>
        <DocLI>Onboarding completion rate 36% to date, early-access cohort (n=11)</DocLI>
      </DocUL>

      <DocH3 id="dtac-interop">Interoperability</DocH3>
      <DocP>
        Flowen supports data export in structured formats for integration with clinical systems. Current integrations and roadmap:
      </DocP>
      <DocTable
        headers={['Capability', 'Status']}
        rows={[
          ['REST API for session data export',    'Planned'],
          ['PDF session reports for clinical record', 'Available'],
          ['FHIR R4 resource export',             'Q1 2027'],
          ['NHS Login integration',               'Q2 2027'],
          ['EPR connector (SystmOne/EMIS)',        'Roadmap — contact us to discuss'],
        ]}
      />

      <DocH2 id="procurement">Procurement routes</DocH2>
      <DocP>NHS commissioners can procure Flowen through several routes depending on contract value and local policy:</DocP>

      <DocH3>G-Cloud (Digital Marketplace)</DocH3>
      <DocP>
        Flowen is not yet listed on G-Cloud. Listing on the Digital Marketplace is planned as part of our NHS readiness work, which would allow NHS bodies and local authorities to procure without a formal tender process.
      </DocP>

      <DocH3>Direct award (under threshold)</DocH3>
      <DocP>
        For contract values below the NHS procurement threshold (currently £213,477 for services), commissioners may award directly following a proportionate market assessment. Flowen's annual contract value for most ICB deployments falls well within this threshold. We can provide a completed supplier information pack to support your assurance process.
      </DocP>

      <DocH3>NHS Shared Business Services (NHS SBS)</DocH3>
      <DocP>
        Flowen is not currently on NHS SBS frameworks. Contact us at <strong className="text-slate-200">hello@flowen.digital</strong> to discuss the appropriate route for your organisation.
      </DocP>

      <DocH2 id="evidence">Evidence base</DocH2>
      <DocP>
        Flowen's clinical approach is grounded in the following evidence domains:
      </DocP>
      <DocUL>
        <DocLI><strong className="text-slate-200">Fluency shaping:</strong> Easy onset, diaphragmatic breathing, and prolonged speech have the strongest evidence base for fluency gains in adults who stammer (Guitar, 2014; O'Brian et al, 2014)</DocLI>
        <DocLI><strong className="text-slate-200">Biofeedback augmentation:</strong> Real-time acoustic and visual biofeedback significantly enhances acquisition of speech techniques versus instruction alone (Ingham et al, 2012; Bothe et al, 2006)</DocLI>
        <DocLI><strong className="text-slate-200">Digital delivery:</strong> Technology-mediated stuttering treatment demonstrates non-inferiority to in-person delivery for adult participants (Carey et al, 2010; Jones et al, 2014)</DocLI>
        <DocLI><strong className="text-slate-200">Self-managed practice:</strong> Daily practice frequency is the primary predictor of long-term fluency maintenance (O'Brian et al, 2014)</DocLI>
      </DocUL>
      <DocP>
        A full evidence summary document is available in our <strong className="text-slate-200">/resources/biofeedback-evidence</strong> guide. Clinical publications and grey literature references available on request.
      </DocP>

      <DocH2 id="commissioning">Commissioning model</DocH2>
      <DocP>Flowen can be commissioned under two primary models:</DocP>
      <DocTable
        headers={['Model', 'Description', 'Best for']}
        rows={[
          ['SLT-supervised adjunct',     'Clinicians prescribe and monitor Flowen as a home practice tool between SLT appointments. Progress data accessible to the SLT via clinician portal.', 'Existing SLT caseloads; IAPT-adjacent fluency pathways'],
          ['Self-managed practice tool', 'Patients access Flowen directly via referral link or self-referral. No ongoing SLT involvement required. Suitable for mild-to-moderate stammering where SLT capacity is limited.', 'ICB-wide digital first pathways; waiting list management'],
        ]}
      />
      <DocP>
        A hybrid model — where initial assessment and goals are set by an SLT and ongoing practice is self-managed — is also supported and recommended for most ICB deployments.
      </DocP>

      <DocH2 id="sla">Service commitments</DocH2>
      <DocTable
        headers={['Area', 'Commitment']}
        rows={[
          ['Support',                    'Email support via hello@flowen.digital; commissioners receive a named contact'],
          ['Data breach notification',   '72 hours (as required by UK GDPR Article 33)'],
          ['Clinical escalation',        'Clinical Safety Officer appointment in progress; clinical queries handled directly with commissioner clinical leads'],
        ]}
      />

      <DocH2 id="implementation">Implementation</DocH2>
      <DocP>
        Flowen's implementation process for NHS commissioners typically takes 4–8 weeks from contract signature to go-live:
      </DocP>
      <DocUL>
        <DocLI><strong className="text-slate-200">Week 1–2:</strong> Contract and DPA execution; DSMFT completion; staff onboarding for clinician portal</DocLI>
        <DocLI><strong className="text-slate-200">Week 2–3:</strong> Configuration of referral pathway and white-label URLs if required</DocLI>
        <DocLI><strong className="text-slate-200">Week 3–4:</strong> Clinician training (1-hour webinar + self-paced materials); patient information leaflet customisation</DocLI>
        <DocLI><strong className="text-slate-200">Week 4–6:</strong> Soft launch with first cohort; 2-week check-in call with implementation lead</DocLI>
        <DocLI><strong className="text-slate-200">Week 6–8:</strong> Full go-live; quarterly review cadence established</DocLI>
      </DocUL>

      <DocH2 id="contact">Get in touch</DocH2>
      <DocCallout variant="tip">
        <DocP>We are available to arrange a demonstration, provide a quote, share current clinical safety and data protection documentation, or discuss bespoke commissioning arrangements. Contact us at <strong className="text-slate-200">hello@flowen.digital</strong> or visit <strong className="text-slate-200">flowen.digital/nhs-framework</strong> for our full NHS commissioning overview.</DocP>
      </DocCallout>

    </DocPageLayout>
  );
}
