import MainNavbar from '@/components/MainNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility Statement — Flowen Speech Platform',
  description: 'Flowen\'s commitment to WCAG 2.1 AA accessibility for people with disabilities, including those who stutter.',
};

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          ACCESSIBILITY
        </span>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Accessibility Statement</h1>
        <p className="text-slate-500 text-xs mt-2">Last updated: 28 July 2026</p>

        <div className="mt-10 space-y-10 text-sm text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Our Commitment</h2>
            <p className="text-slate-400">
              Flowen is built for people who stutter. Many of our users have additional disabilities — anxiety, motor impairments, and neurodivergent conditions are disproportionately prevalent in the stuttering community. We take accessibility seriously, not as a compliance checkbox, but as a core design requirement.
            </p>
            <p className="text-slate-400 mt-3">
              We are working toward conformance with the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA. This is our current status and the areas where we are still improving.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Conformance Status</h2>
            <p className="text-slate-400 mb-5">
              Flowen is <strong className="text-white">partially conformant</strong> with WCAG 2.1 Level AA. Partial conformance means some parts of the content do not fully conform to the standard.
            </p>
            <div className="space-y-3">
              {[
                { area: 'Colour contrast', status: 'Compliant', note: 'All text elements meet the 4.5:1 minimum contrast ratio. Interactive elements meet 3:1.' },
                { area: 'Keyboard navigation', status: 'Partial', note: 'Core flows (login, dashboard, practice engine) are keyboard-navigable. Some advanced settings panels are being improved.' },
                { area: 'Screen reader support', status: 'Partial', note: 'ARIA labels are applied to all form controls and interactive elements. The 3D avatar biofeedback view has a text-only alternative mode in development.' },
                { area: 'Focus management', status: 'Compliant', note: 'Focus indicators are visible on all interactive elements. Modal focus trapping is implemented.' },
                { area: 'Text resizing', status: 'Compliant', note: 'The interface scales correctly up to 200% zoom without horizontal scrolling on desktop.' },
                { area: 'Motion & animation', status: 'Compliant', note: 'The biofeedback pacer respects prefers-reduced-motion. Animations can be disabled in account settings.' },
                { area: 'Captions & transcripts', status: 'In progress', note: 'Session recordings will include auto-generated transcripts. Currently available on request.' },
              ].map(row => (
                <div key={row.area} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold text-sm">{row.area}</span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                      row.status === 'Compliant'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : row.status === 'Partial'
                        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>{row.status}</span>
                  </div>
                  <p className="text-slate-400 text-xs">{row.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Known Limitations</h2>
            <ul className="space-y-3 text-slate-400">
              <li className="flex items-start gap-3">
                <span className="text-slate-600 flex-shrink-0 font-bold mt-0.5">—</span>
                The real-time 3D avatar biofeedback view requires WebGL. A 2D text-only fallback is in development for users who cannot use WebGL.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-600 flex-shrink-0 font-bold mt-0.5">—</span>
                The audio capture feature requires a microphone. Users without microphone access receive a static reference guide mode.
              </li>
              <li className="flex items-start gap-3">
                <span className="text-slate-600 flex-shrink-0 font-bold mt-0.5">—</span>
                Some data visualisation charts in the analytics dashboard currently lack text alternatives. We are adding ARIA table equivalents.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Assistive Technologies Tested</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                'NVDA + Chrome (Windows)',
                'JAWS + Chrome (Windows)',
                'VoiceOver + Safari (macOS)',
                'VoiceOver + Safari (iOS)',
                'TalkBack + Chrome (Android)',
                'Dragon NaturallySpeaking',
              ].map(at => (
                <div key={at} className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-xs text-slate-300">
                  {at}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Feedback & Contact</h2>
            <p className="text-slate-400 mb-4">
              If you experience any accessibility barrier when using Flowen, or if you need content in an alternative format, please contact us:
            </p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <dl className="space-y-3 text-sm">
                <div><dt className="text-slate-500 text-xs">Email</dt><dd className="text-emerald-400 mt-0.5"><a href="mailto:flowenspeech@outlook.com?subject=[ACCESSIBILITY]">flowenspeech@outlook.com</a></dd></div>
                <div><dt className="text-slate-500 text-xs">Subject line</dt><dd className="text-slate-300 font-mono mt-0.5">[ACCESSIBILITY]</dd></div>
                <div><dt className="text-slate-500 text-xs">Response time</dt><dd className="text-slate-300 mt-0.5">Within 5 working days</dd></div>
              </dl>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-4">Legal Basis</h2>
            <p className="text-slate-400">
              This statement is provided in accordance with the Public Sector Bodies (Websites and Mobile Applications) (No.2) Accessibility Regulations 2018 and the Equality Act 2010. The platform was internally audited in July 2026. An independent WCAG 2.1 AA audit is scheduled for Q4 2026.
            </p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
