import type { Metadata } from 'next';
import DocPageLayout, {
  DocH2, DocH3, DocP, DocUL, DocLI, DocCallout, DocTable,
} from '@/components/DocPageLayout';

export const metadata: Metadata = {
  title: 'NHS ICB Procurement Guide — Flowen Resources',
  description: 'Commissioner guide for procuring Flowen under DTAC and NHS Digital frameworks. Clinical safety, evidence base, and procurement routes.',
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
      title="NHS ICB Procurement for Digital Therapeutics"
      subtitle="A commissioner's guide to procuring Flowen under the Digital Technology Assessment Criteria (DTAC). Covers clinical safety compliance, evidence base, procurement routes, and service commitments."
      date="August 2026"
      readTime="15 min"
      toc={TOC}
    >

      <DocH2 id="overview">Overview</DocH2>
      <DocP>
        Flowen is a regulated digital therapeutic platform for fluency disorders (stammering, cluttering, and neurogenic fluency disorders). It delivers real-time neural biofeedback and speech coordination training using evidence-based techniques aligned with RCSLT clinical guidance on fluency therapy.
      </DocP>
      <DocP>
        Flowen has been designed for NHS commissioning from the ground up. It complies with DCB0129 Clinical Safety Standard, aligns with NHS Digital's Digital Technology Assessment Criteria (DTAC), and is built on UK data residency infrastructure compliant with UK GDPR and the Data Security and Protection (DSP) Toolkit requirements.
      </DocP>
      <DocCallout variant="info">
        <DocP>Flowen is suitable for commissioning by Integrated Care Boards (ICBs), NHS Trusts, Primary Care Networks (PCNs), and IAPT/TALKIAPS services. It can operate as a standalone digital therapeutic or as a supervised adjunct to SLT-led care.</DocP>
      </DocCallout>

      <DocH2 id="dtac">DTAC Alignment</DocH2>
      <DocP>
        The Digital Technology Assessment Criteria (DTAC) is the NHS England framework for assessing digital health tools before procurement. It covers five domains: clinical safety, data protection, technical assurance, usability, and interoperability.
      </DocP>

      <DocH3 id="dtac-clinical">Clinical safety — DCB0129</DocH3>
      <DocP>
        Flowen is developed and maintained in compliance with NHS England's DCB0129 Clinical Safety Standard for health IT systems. The standard mandates:
      </DocP>
      <DocUL>
        <DocLI>Appointment of a Clinical Safety Officer (CSO) with appropriate clinical and technical qualifications</DocLI>
        <DocLI>A Clinical Safety Case Report (CSCR) documenting hazard identification, risk assessment, and mitigations</DocLI>
        <DocLI>A maintained and monitored Hazard Log</DocLI>
        <DocLI>Defined clinical risk management processes</DocLI>
        <DocLI>Incident reporting and response procedures</DocLI>
      </DocUL>
      <DocP>
        All DCB0129 documentation is available on request. Our Clinical Safety Officer can be reached at <strong className="text-slate-200">clinical@flowen.digital</strong>.
      </DocP>

      <DocH3 id="dtac-data">Data security — UK GDPR &amp; DSP Toolkit</DocH3>
      <DocP>
        Flowen processes personal health data as a data controller (for direct-access users) and data processor (in clinical deployment models). Our data governance framework includes:
      </DocP>
      <DocTable
        headers={['Requirement', 'Flowen position']}
        rows={[
          ['UK GDPR compliance',           'Full — Privacy-by-design architecture, DPA executed'],
          ['Data Processing Agreement',     'Standard DPA available; NHS-specific DPA on request'],
          ['Data residency',                'All data processed and stored in UK (AWS eu-west-2)'],
          ['Encryption at rest',           'AES-256 on all stored data'],
          ['Encryption in transit',        'TLS 1.3 on all connections'],
          ['DSPT alignment',               'Self-assessment completed; evidence pack available'],
          ['Penetration testing',          'Annual pen test by CREST-accredited third party'],
          ['Retention & deletion',         'Configurable per commissioner; default 2-year retention, full deletion on request'],
        ]}
      />
      <DocP>
        A Data Protection Impact Assessment (DPIA) template for NHS deployments is available on request. Our Data Protection Officer can be contacted at <strong className="text-slate-200">privacy@flowen.digital</strong>.
      </DocP>

      <DocH3 id="dtac-technical">Technical assurance</DocH3>
      <DocP>Flowen is a cloud-native web application. Key technical specifications:</DocP>
      <DocUL>
        <DocLI>Browser-based — no app store dependency, works on any modern browser including NHS-managed devices</DocLI>
        <DocLI>99.9% uptime SLA with scheduled maintenance windows communicated 72 hours in advance</DocLI>
        <DocLI>Automated backup with 4-hour RPO and 8-hour RTO</DocLI>
        <DocLI>Multi-region failover with active health monitoring</DocLI>
        <DocLI>Continuous dependency scanning and automated security patching</DocLI>
        <DocLI>Change management process with clinical safety review for significant updates</DocLI>
      </DocUL>

      <DocH3 id="dtac-usability">Usability &amp; accessibility</DocH3>
      <DocUL>
        <DocLI>WCAG 2.2 AA conformance (accessibility statement available at flowen.digital/accessibility)</DocLI>
        <DocLI>Tested with assistive technologies including JAWS, NVDA, and VoiceOver</DocLI>
        <DocLI>Plain English content rated at Flesch-Kincaid Grade 8 or below</DocLI>
        <DocLI>Mobile and tablet compatible for use across devices</DocLI>
        <DocLI>Onboarding completion rate &gt;88% in beta cohort</DocLI>
      </DocUL>

      <DocH3 id="dtac-interop">Interoperability</DocH3>
      <DocP>
        Flowen supports data export in structured formats for integration with clinical systems. Current integrations and roadmap:
      </DocP>
      <DocTable
        headers={['Capability', 'Status']}
        rows={[
          ['REST API for session data export',    'Available'],
          ['PDF session reports for clinical record', 'Available'],
          ['FHIR R4 resource export',             'Q1 2027'],
          ['NHS Login integration',               'Q2 2027'],
          ['EPR connector (SystmOne/EMIS)',        'Roadmap — contact us to discuss'],
        ]}
      />

      <DocH2 id="procurement">Procurement routes</DocH2>
      <DocP>NHS commissioners can procure Flowen through several routes depending on contract value and local policy:</DocP>

      <DocH3>G-Cloud 14 (Digital Marketplace)</DocH3>
      <DocP>
        Flowen is listed on Crown Commercial Service G-Cloud 14 under the Cloud Software category. G-Cloud is available to all NHS bodies and local authorities without the need for a formal tender process, regardless of contract value. Search for <strong className="text-slate-200">"Flowen"</strong> on the Digital Marketplace at <strong className="text-slate-200">digitalmarketplace.service.gov.uk</strong>.
      </DocP>

      <DocH3>Direct award (under threshold)</DocH3>
      <DocP>
        For contract values below the NHS procurement threshold (currently £213,477 for services), commissioners may award directly following a proportionate market assessment. Flowen's annual contract value for most ICB deployments falls well within this threshold. We can provide a completed supplier information pack to support your assurance process.
      </DocP>

      <DocH3>NHS Shared Business Services (NHS SBS)</DocH3>
      <DocP>
        Flowen is available through NHS SBS frameworks where applicable. Contact our commercial team at <strong className="text-slate-200">hello@flowen.digital</strong> to obtain a tailored quote and framework reference.
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
          ['Self-managed digital therapeutic', 'Patients access Flowen directly via referral link or self-referral. No ongoing SLT involvement required. Suitable for mild-to-moderate stammering where SLT capacity is limited.', 'ICB-wide digital first pathways; waiting list management'],
        ]}
      />
      <DocP>
        A hybrid model — where initial assessment and goals are set by an SLT and ongoing practice is self-managed — is also supported and recommended for most ICB deployments.
      </DocP>

      <DocH2 id="sla">Service level commitments</DocH2>
      <DocTable
        headers={['Metric', 'Commitment']}
        rows={[
          ['Platform uptime',            '99.9% monthly (excluding planned maintenance)'],
          ['Planned maintenance notice', '≥72 hours advance notice via email and status page'],
          ['Incident response (P1)',      '1 hour acknowledgement, 4 hour resolution target'],
          ['Incident response (P2)',      '4 hour acknowledgement, 24 hour resolution target'],
          ['Data breach notification',   '72 hours (as required by UK GDPR Article 33)'],
          ['Support hours',              'Monday–Friday, 9am–5pm GMT; critical incidents 24/7'],
          ['Clinical escalation',        'Named Clinical Safety Officer; direct line available to commissioner clinical leads'],
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
        <DocP>Our NHS and public sector team is available to arrange a demonstration, provide a quote, supply DTAC evidence packs, or discuss bespoke commissioning arrangements. Contact us at <strong className="text-slate-200">hello@flowen.digital</strong> or visit <strong className="text-slate-200">flowen.digital/nhs-framework</strong> for our full NHS commissioning overview.</DocP>
      </DocCallout>

    </DocPageLayout>
  );
}
