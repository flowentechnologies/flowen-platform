import MainNavbar from '@/components/MainNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resources — Flowen Speech Platform',
  description: 'Clinical guidance, funding pathways, and research on stuttering therapy, biofeedback, and the evidence base behind Flowen.',
};

const GUIDES = [
  {
    tag: 'FUNDING',
    title: 'How to Use Access to Work for Flowen',
    desc: 'Access to Work is a government grant that funds workplace support for people with disabilities. This guide covers how to apply, what to include in your application, and how Flowen qualifies as assistive technology.',
    href: '/#contact',
    cta: 'Speak to Our Team',
  },
  {
    tag: 'NHS',
    title: 'NHS ICB Procurement for Digital Therapeutics',
    desc: 'A guide for NHS commissioners on procuring Flowen under the Digital Technology Assessment Criteria (DTAC). Includes the clinical safety case summary, evidence base, and contracting pathway.',
    href: '/#contact',
    cta: 'Request Documentation',
  },
  {
    tag: 'CLINICAL',
    title: 'Easy-Onset Techniques: Clinical Rationale',
    desc: 'An overview of the evidence base for easy onset, prolonged speech, and diaphragmatic breathing as fluency-shaping techniques, and how Flowen operationalises each through real-time acoustic biofeedback.',
    href: '/#contact',
    cta: 'Download PDF',
  },
  {
    tag: 'DISABILITY',
    title: 'Disabled Students\' Allowance (DSA) Guide',
    desc: 'DSA supports UK students with disabilities at university. This guide explains how to evidence a DSA application for Flowen as a digital therapeutic tool, and which assessors typically approve assistive software.',
    href: '/#contact',
    cta: 'Contact Us',
  },
  {
    tag: 'RESEARCH',
    title: 'Biofeedback in Stuttering Therapy: Evidence Summary',
    desc: 'A curated summary of peer-reviewed research on acoustic biofeedback, delayed auditory feedback (DAF), and frequency-altered feedback (FAF) in stuttering therapy, and how Flowen\'s approach compares.',
    href: '/#contact',
    cta: 'Request Summary',
  },
  {
    tag: 'GOVERNANCE',
    title: 'DCB0129 Clinical Safety Documentation',
    desc: 'Flowen\'s Clinical Safety Case Report, Hazard Log, and Safety Officer appointment, prepared in compliance with the NHS Digital DCB0129 standard for health IT systems.',
    href: '/security#dcb0129',
    cta: 'View Security Page',
  },
];

const EXTERNAL_LINKS = [
  { label: 'British Stammering Association', url: 'https://stamma.org', desc: 'The UK\'s national charity for people who stammer.' },
  { label: 'RCSLT — Stammering Clinical Guidance', url: 'https://www.rcslt.org/speech-and-language-therapy/clinical-information/fluency/', desc: 'Royal College of Speech and Language Therapists\' clinical guidance on fluency disorders.' },
  { label: 'NHS Access to Work', url: 'https://www.gov.uk/access-to-work', desc: 'UK government scheme funding workplace support for disabled employees.' },
  { label: 'Disabled Students\' Allowance', url: 'https://www.gov.uk/disabled-students-allowance-dsa', desc: 'DSA funding for disabled students in UK higher education.' },
  { label: 'NHS DTAC Framework', url: 'https://www.nhsx.nhs.uk/key-tools-and-info/digital-technology-assessment-criteria-dtac/', desc: 'NHS guidance for procuring safe, effective digital health tools.' },
];

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />

      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 py-16 text-center">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            KNOWLEDGE BASE
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Resources</h1>
          <p className="text-slate-400 text-sm mt-3 max-w-xl mx-auto">
            Guides for individuals, clinicians, and commissioners. Funding pathways, clinical evidence, and governance documentation.
          </p>
        </section>

        {/* Guides */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-8 pb-3 border-b border-slate-800">
            Guides & Documentation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {GUIDES.map(g => (
              <div key={g.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-7 flex flex-col justify-between hover:border-slate-700 transition-all">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">{g.tag}</span>
                  <h3 className="text-base font-bold text-white mt-2 mb-3">{g.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{g.desc}</p>
                </div>
                <Link href={g.href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                  {g.cta}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* External links */}
        <section className="border-t border-slate-800/60 max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-8 pb-3 border-b border-slate-800">
            External Resources
          </h2>
          <div className="space-y-4">
            {EXTERNAL_LINKS.map(link => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group"
              >
                <div>
                  <div className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors">{link.label}</div>
                  <div className="text-slate-500 text-xs mt-1">{link.desc}</div>
                </div>
                <svg className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-0.5 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-800/60 max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-xl font-bold text-white mb-3">Need something specific?</h2>
          <p className="text-slate-400 text-sm mb-8">Our clinical and commercial team can provide bespoke documentation for NHS procurement, Access to Work applications, or DSA assessments.</p>
          <Link href="/#contact" className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all inline-block">
            Contact Our Team
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
