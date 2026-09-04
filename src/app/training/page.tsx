import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

export const metadata: Metadata = {
  title: 'Training Manuals — Flowen',
  description: 'Official training manuals for Flowen staff, Speech & Language Therapists, and NHS clinical teams.',
};

const MANUALS = [
  {
    href: '/training/clinicians',
    audience: 'Speech & Language Therapists',
    tag: 'SLT',
    tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    title: 'SLT Clinical Training Manual',
    description:
      'Getting started with the Flowen SLT portal. Covers patient enrolment, session telemetry, programme management, clinical responsibilities, and data governance.',
    sections: ['Portal navigation', 'Enrolling patients', 'Reading telemetry', 'Progress reports', 'Clinical safety'],
    readTime: '25 min',
  },
  {
    href: '/training/nhs',
    audience: 'NHS Commissioners & Clinical Leads',
    tag: 'NHS',
    tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    title: 'NHS Implementation Training',
    description:
      'Clinical governance, patient eligibility, referral pathways, DSPT compliance, staff roles, care pathway integration, and escalation procedures for NHS settings.',
    sections: ['Clinical governance', 'Patient eligibility', 'Referral pathway', 'Data security', 'Audit & reporting'],
    readTime: '30 min',
  },
  {
    href: '/training/staff',
    audience: 'Flowen Internal Staff',
    tag: 'INTERNAL',
    tagColor: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
    title: 'Flowen Staff Training Manual',
    description:
      'Platform architecture, admin portal, user management, data handling, clinical safety obligations, incident response, and acceptable use policy for Flowen staff.',
    sections: ['Admin portal', 'User management', 'Data handling', 'Incident response', 'Acceptable use'],
    readTime: '35 min',
  },
];

export default function TrainingPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-white flex flex-col">
      <MarketingNavbar />

      <div className="max-w-5xl mx-auto px-6 pt-6 pb-0">
        <nav className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Training</span>
        </nav>
      </div>

      <main id="main-content" className="flex-1 max-w-5xl mx-auto px-6 py-16 w-full">
        <div className="mb-14">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-5">
            Training Materials
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
            Flowen Training Manuals
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-2xl">
            Official training documentation for each stakeholder group. Select the manual relevant to your role. All manuals are printable via the button on each page.
          </p>
        </div>

        <div className="space-y-5">
          {MANUALS.map(m => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex flex-col sm:flex-row gap-6 bg-slate-900/50 border border-slate-800 hover:border-slate-600 rounded-2xl p-7 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-bold uppercase tracking-widest ${m.tagColor}`}>
                    {m.tag}
                  </span>
                  <span className="text-xs text-slate-400">{m.audience}</span>
                  <span className="text-xs text-slate-500">· {m.readTime} read</span>
                </div>
                <h2 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  {m.title}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-4">{m.description}</p>
                <div className="flex flex-wrap gap-2">
                  {m.sections.map(s => (
                    <span key={s} className="px-2.5 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center shrink-0 text-slate-500 group-hover:text-emerald-400 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-14 p-6 rounded-2xl border border-slate-800 bg-slate-900/30">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-2">Version control</p>
          <p className="text-sm text-slate-400">
            These manuals reflect the current platform as of <span className="text-slate-300">August 2026</span>. They are reviewed and updated with each significant platform release. Direct questions to{' '}
            <a href="mailto:clinical@flowen.digital" className="text-emerald-400 hover:text-emerald-300 transition-colors">clinical@flowen.digital</a>.
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
