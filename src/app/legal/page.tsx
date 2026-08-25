import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MASTER_POLICIES } from './policies';

export const metadata: Metadata = {
  title: 'Legal & Privacy — Flowen Speech Platform',
  description: 'Flowen\'s terms of service, privacy policy, UK GDPR statement, DCB0129 clinical safety case, and cookie policy.',
};

const SECTIONS = [
  {
    id: 'terms-of-service',
    title: 'Terms of Service',
    tag: 'CONTRACT',
    summary: 'Binding agreement governing access to and use of the Flowen platform, subscription terms, and limitations of liability.',
    content: MASTER_POLICIES.termsOfService,
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy & UK GDPR',
    tag: 'DATA PROTECTION',
    summary: 'How we collect, process, and protect your personal data under the UK GDPR and Data Protection Act 2018.',
    content: MASTER_POLICIES.privacyPolicy,
  },
  {
    id: 'clinical-safety',
    title: 'DCB0129 Clinical Safety Statement',
    tag: 'CLINICAL GOVERNANCE',
    summary: 'Our compliance with the NHS Digital DCB0129 Clinical Safety Standard for Health IT systems.',
    content: MASTER_POLICIES.clinicalCompliance,
  },
  {
    id: 'cookie-policy',
    title: 'Cookie Policy',
    tag: 'PECR 2003',
    summary: 'Every cookie we set — strictly necessary auth tokens, first-party analytics (__vs, __utm, flowen_anon_id), affiliate tracking, and third-party tools.',
    content: MASTER_POLICIES.cookiePolicy,
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    tag: 'JURISDICTION',
    summary: 'These agreements are governed by the laws of England and Wales.',
    content: MASTER_POLICIES.governingLaw,
  },
];

const RELATED_PAGES = [
  { title: 'Cookie Policy', href: '/cookie-policy', desc: 'Full details on every cookie we set and how to manage them.' },
  { title: 'Security & Compliance', href: '/security', desc: 'Technical controls, encryption, and DCB0129 hazard log details.' },
  { title: 'Accessibility Statement', href: '/accessibility', desc: 'WCAG 2.1 AA conformance status and assistive technology support.' },
  { title: 'Data Processing Agreement', href: '/dpa', desc: 'UK GDPR Article 28 DPA for NHS trusts, ICBs, and institutional customers.' },
  { title: 'NHS Commissioning Framework', href: '/nhs-framework', desc: 'DTAC evidence pack, procurement pathway, and service level commitments.' },
];

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-16">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          GOVERNANCE
        </span>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Legal & Privacy</h1>
        <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-2xl">
          Flowen Group HoldCo is registered under UK GDPR, governed by the laws of England and Wales, and operates under the NHS Digital DCB0129 Clinical Safety Standard. All policies effective from{' '}
          <span className="text-slate-300">{MASTER_POLICIES.effectiveDate}</span>.
        </p>

        <div className="mt-12 space-y-6">
          {SECTIONS.map(section => (
            <details key={section.title} id={section.id} className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none hover:bg-slate-800/40 transition-colors">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">{section.tag}</span>
                  <h2 className="text-base font-bold text-white mt-1">{section.title}</h2>
                  <p className="text-slate-500 text-xs mt-1">{section.summary}</p>
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
                  {section.content.trim()}
                </pre>
              </div>
            </details>
          ))}
        </div>

        {/* Related pages */}
        <div className="mt-14">
          <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-6 pb-3 border-b border-slate-800">
            Related Documents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {RELATED_PAGES.map(page => (
              <Link
                key={page.title}
                href={page.href}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group"
              >
                <div className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors">{page.title}</div>
                <div className="text-slate-500 text-xs mt-1 leading-relaxed">{page.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-12 bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-sm text-slate-400">
          <strong className="text-white">Questions?</strong> Contact our Data Protection Officer at{' '}
          <a href="mailto:hello@flowen.digital" className="text-emerald-400 hover:underline">
            hello@flowen.digital
          </a>
          . We respond within one calendar month as required by UK GDPR Article 12.
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
