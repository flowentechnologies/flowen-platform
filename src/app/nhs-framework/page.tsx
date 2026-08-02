import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NHS & ICB Partnership Framework — Flowen Speech Platform',
  description: 'Flowen\'s NHS commissioning framework: DCB0129 clinical safety, DTAC alignment, ICB procurement pathway, and service level commitments.',
};

const PATHWAY_STEPS = [
  {
    step: '01',
    title: 'Initial Enquiry & Scoping',
    duration: 'Week 1–2',
    detail: 'Contact Flowen at flowenspeech@outlook.com. We\'ll schedule a discovery call with your SLT service lead and procurement team to understand your patient population, caseload volume, and integration requirements. We\'ll provide our DTAC evidence pack, DCB0129 documentation, and a draft Data Processing Agreement for your IG team.',
  },
  {
    step: '02',
    title: 'Clinical Review & IG Sign-off',
    duration: 'Week 2–6',
    detail: 'Your Deployment Clinical Safety Officer (DCB0160) reviews our Clinical Safety Case Report and Hazard Log. Your IG/data protection team reviews the DPA and DSPT alignment evidence. We\'ll provide reference calls with existing clinical users and facilitate access to a sandboxed demo environment.',
  },
  {
    step: '03',
    title: 'Procurement & Contracting',
    duration: 'Week 4–8',
    detail: 'Flowen is available via direct award under NHS supply frameworks for digital health tools below the OJEU threshold. For larger contracts, we support full tender processes. Our standard contract includes SLA commitments, exit provisions, data migration rights, and a service credit mechanism.',
  },
  {
    step: '04',
    title: 'Implementation & Training',
    duration: 'Week 6–10',
    detail: 'We onboard your SLT clinicians (remote training, typically 2 hours) and configure your ICB or trust account. Patient enrolment can begin immediately after training. Clinical lead receives admin dashboard access and SLP tooling. Go-live supported by a named Flowen implementation contact.',
  },
  {
    step: '05',
    title: 'Ongoing Service & Review',
    duration: 'Quarterly',
    detail: 'Quarterly service reviews with your clinical lead. Usage reports, patient outcome data, and system uptime reports provided. Annual contract review with pricing locked per agreement. Flowen\'s clinical safety officer available for any incident escalations within 24 hours.',
  },
];

const EVIDENCE_ITEMS = [
  {
    category: 'Clinical Safety',
    items: [
      'DCB0129 Clinical Safety Case Report (v1.2)',
      'Hazard Log with residual risk ratings',
      'Clinical Safety Officer appointment letter',
      'DCB0160 deployment checklist for NHS organisations',
      'Clinical Safety Incident reporting procedure',
    ],
  },
  {
    category: 'Data Protection & IG',
    items: [
      'Data Processing Agreement (UK GDPR Article 28)',
      'UK GDPR / Data Protection Act 2018 compliance statement',
      'DSPT baseline alignment evidence',
      'Sub-processor register with transfer safeguards',
      'Article 30 Records of Processing Activities (on request)',
      'Data Protection Impact Assessment template',
    ],
  },
  {
    category: 'Technical Security',
    items: [
      'DTAC Technical Security alignment statement',
      'Penetration test summary (annual)',
      'Encryption and data residency confirmation (UK-GBR)',
      'Vulnerability management policy',
      'Business continuity and disaster recovery plan',
    ],
  },
  {
    category: 'Usability & Accessibility',
    items: [
      'WCAG 2.1 AA accessibility statement',
      'Assistive technology compatibility matrix (NVDA, JAWS, VoiceOver, TalkBack, Dragon)',
      'User acceptance testing results with persons who stammer',
      'Patient and carer information leaflet templates',
    ],
  },
  {
    category: 'Clinical Evidence',
    items: [
      'Evidence summary: fluency shaping and stuttering modification techniques',
      'Alignment with STAMMA clinical guidance and RCSLT best practice',
      'Outcome measurement framework (BPM, self-rating scales)',
      'Case studies and clinician testimonials (available on request)',
    ],
  },
];

const SLA = [
  { metric: 'Platform uptime', commitment: '99.5% monthly', measurement: 'Vercel infrastructure monitoring, 5-minute checks' },
  { metric: 'Planned maintenance', commitment: '≥72 hours notice', measurement: 'Email notification to designated NHS contact' },
  { metric: 'Critical incident response', commitment: '1 hour acknowledgement', measurement: 'From first report to confirmation of investigation start' },
  { metric: 'Critical incident resolution', commitment: '4 hours target', measurement: 'Major service restoration; workaround or fix' },
  { metric: 'Clinical safety incident acknowledgement', commitment: '24 hours', measurement: 'From report to written acknowledgement' },
  { metric: 'Data subject access request assistance', commitment: '3 business days', measurement: 'Providing Controller with data extract or response support' },
  { metric: 'Data breach notification', commitment: '72 hours', measurement: 'From Processor becoming aware to Controller notification' },
  { metric: 'Support response (non-critical)', commitment: '2 business days', measurement: 'Email to flowenspeech@outlook.com' },
];

export default function NHSFrameworkPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main className="flex-1">

        {/* Header */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            NHS & ICB PARTNERSHIPS
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">
            NHS Commissioning Framework
          </h1>
          <p className="text-slate-400 text-sm mt-3 max-w-2xl leading-relaxed">
            Flowen is designed for NHS commissioning from the ground up — DCB0129 clinical safety, UK GDPR
            compliance, DTAC alignment, and a clear procurement pathway for ICBs and NHS trusts.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {['DCB0129 Compliant', 'DTAC Aligned', 'UK GDPR / DPA 2018', 'DSPT Baseline', 'WCAG 2.1 AA'].map(badge => (
              <span key={badge} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {badge}
              </span>
            ))}
          </div>
        </section>

        {/* Value proposition */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-8 pb-3 border-b border-slate-800">
            The Case for Flowen in NHS SLT Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Extend SLT Capacity',
                body: 'Flowen provides structured, evidence-based practice between appointments, increasing effective therapy contact time without adding to caseload. SLPs retain clinical oversight through the dashboard.',
              },
              {
                title: 'Objective Outcome Data',
                body: 'Real-time BPM tracking, session adherence data, and structured progress reports give SLPs objective evidence of patient engagement and technique acquisition for clinical records.',
              },
              {
                title: 'NICE-Aligned Techniques',
                body: 'Flowen\'s 8-week programme is structured around evidence-based fluency shaping techniques (diaphragmatic breathing, easy onset, LACs, pausing) aligned with RCSLT clinical guidance for adults who stammer.',
              },
            ].map(card => (
              <div key={card.title} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-bold text-sm mb-2">{card.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Procurement pathway */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-8 pb-3 border-b border-slate-800">
            Procurement Pathway
          </h2>
          <div className="space-y-4">
            {PATHWAY_STEPS.map(step => (
              <div key={step.step} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex gap-5">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm font-mono">
                  {step.step}
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <h3 className="text-white font-bold text-sm">{step.title}</h3>
                    <span className="text-xs font-mono text-slate-500 flex-shrink-0">{step.duration}</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed mt-2">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Evidence pack */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-8 pb-3 border-b border-slate-800">
            DTAC Evidence Pack Contents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {EVIDENCE_ITEMS.map(section => (
              <div key={section.category} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-bold text-sm mb-3">{section.category}</h3>
                <ul className="space-y-2">
                  {section.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-slate-400 text-sm">
                      <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-4">
            Full evidence pack provided to NHS procurement teams on request. Contact flowenspeech@outlook.com with subject line &quot;DTAC Evidence Request — [Organisation]&quot;.
          </p>
        </section>

        {/* SLA */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-8 pb-3 border-b border-slate-800">
            Service Level Commitments
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Metric</th>
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest">Commitment</th>
                  <th className="text-left p-4 text-xs font-mono text-slate-400 uppercase tracking-widest hidden md:table-cell">Measurement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {SLA.map(row => (
                  <tr key={row.metric} className="bg-slate-900/30 hover:bg-slate-900/60 transition-colors">
                    <td className="p-4 text-white">{row.metric}</td>
                    <td className="p-4 text-emerald-400 font-mono text-xs font-bold">{row.commitment}</td>
                    <td className="p-4 text-slate-400 text-xs hidden md:table-cell">{row.measurement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            SLA credits apply where commitments are not met as defined in the commercial agreement. Service credits do not limit other remedies available to the Controller.
          </p>
        </section>

        {/* Pricing */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-12">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400 mb-8 pb-3 border-b border-slate-800">
            Commissioning Models
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                model: 'Per-Patient Licence',
                description: 'Annual per-patient licence fee. Suitable for defined patient populations within an SLT service. Includes full SLP dashboard access.',
                best: 'ICBs and NHS trusts with defined caseloads',
              },
              {
                model: 'SLT Practice Licence',
                description: 'Per-clinician licence covering unlimited patients within the licensed practice. Annual fee per registered SLP.',
                best: 'Private SLT practices and smaller NHS teams',
              },
              {
                model: 'Block Contract',
                description: 'Annual block contract with agreed access volumes. Suitable for large-scale ICB roll-outs with step-down pricing tiers.',
                best: 'ICB-wide commissioning and regional programmes',
              },
            ].map(model => (
              <div key={model.model} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                <h3 className="text-white font-bold text-sm mb-2">{model.model}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-3">{model.description}</p>
                <p className="text-xs text-emerald-400 font-medium">Best for: {model.best}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-4">
            Pricing is provided on request based on your organisation&apos;s scale and requirements. We do not publish list prices for NHS contracts — contact us for a tailored proposal.
          </p>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-800/60 max-w-4xl mx-auto px-6 py-16">
          <div className="bg-slate-900/50 border border-emerald-500/20 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Start the Conversation</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xl mx-auto">
              Whether you&apos;re an ICB commissioner, an NHS SLT service lead, or a private clinic, we&apos;d
              welcome the opportunity to discuss how Flowen can support your patients who stammer.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <a
                href="mailto:flowenspeech@outlook.com?subject=NHS Commissioning Enquiry — [Organisation]"
                className="inline-block bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                Commissioning Enquiry →
              </a>
              <Link
                href="/security#dcb0129"
                className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                View DCB0129 Statement
              </Link>
              <Link
                href="/dpa"
                className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors"
              >
                Data Processing Agreement
              </Link>
            </div>
          </div>
        </section>

      </main>

      <MarketingFooter />
    </div>
  );
}
