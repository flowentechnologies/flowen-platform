import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — Flowen Speech Platform',
  description: 'How Flowen uses cookies and similar technologies on its platform, and how you can manage your preferences.',
};

const COOKIES = [
  {
    category: 'Strictly Necessary',
    required: true,
    desc: 'These cookies are essential for the platform to function. They cannot be disabled.',
    cookies: [
      { name: 'sb-*-auth-token', purpose: 'Supabase authentication session token. Maintains your logged-in state.', duration: 'Session / up to 1 year', provider: 'Flowen / Supabase' },
      { name: 'flowen_ob', purpose: 'Onboarding completion flag. Prevents repeated profile setup queries on every page load.', duration: '1 year', provider: 'Flowen' },
      { name: '__Secure-next-auth.session-token', purpose: 'Next.js session management.', duration: 'Session', provider: 'Flowen' },
    ],
  },
  {
    category: 'Functional',
    required: false,
    desc: 'These cookies enable personalised features and remember your preferences.',
    cookies: [
      { name: 'flowen_theme', purpose: 'Remembers your UI theme preference (dark/light).', duration: '1 year', provider: 'Flowen' },
      { name: 'flowen_locale', purpose: 'Remembers your language and regional format preferences.', duration: '1 year', provider: 'Flowen' },
    ],
  },
  {
    category: 'Analytics',
    required: false,
    desc: 'These cookies help us understand how the platform is used so we can improve it. No personally-identifying data is included.',
    cookies: [
      { name: 'vercel-analytics-*', purpose: 'Anonymised page view analytics via Vercel Analytics. No cross-site tracking.', duration: '30 days', provider: 'Vercel' },
      { name: '_sentry_*', purpose: 'Error monitoring session data. Used only when an application error occurs.', duration: 'Session', provider: 'Sentry (EU servers)' },
    ],
  },
  {
    category: 'Marketing / Tracking',
    required: false,
    desc: 'Flowen does not use advertising or third-party tracking cookies.',
    cookies: [],
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main className="flex-1 max-w-3xl mx-auto px-6 py-16">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          LEGAL
        </span>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4">Cookie Policy</h1>
        <p className="text-slate-500 text-xs mt-2">Last updated: 28 July 2026</p>

        <div className="mt-10 space-y-5 text-sm text-slate-400 leading-relaxed">
          <p>
            This Cookie Policy explains how Flowen Group HoldCo (&quot;Flowen&quot;, &quot;we&quot;, &quot;us&quot;) uses cookies and similar technologies when you use our website and platform at <span className="text-slate-200">flowen.digital</span>.
          </p>
          <p>
            We operate under the UK&apos;s Privacy and Electronic Communications Regulations (PECR) 2003 and the UK General Data Protection Regulation (UK GDPR). We only set non-essential cookies with your explicit consent.
          </p>
        </div>

        <div className="mt-12 space-y-10">
          {COOKIES.map(group => (
            <div key={group.category}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">{group.category}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  group.required
                    ? 'bg-slate-800 text-slate-500 border border-slate-700'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {group.required ? 'Always active' : 'Optional'}
                </span>
              </div>
              <p className="text-slate-500 text-xs mb-5">{group.desc}</p>

              {group.cookies.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 text-slate-500 text-xs italic">
                  No marketing or advertising cookies are used.
                </div>
              ) : (
                <div className="space-y-3">
                  {group.cookies.map(cookie => (
                    <div key={cookie.name} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
                      <div className="font-mono text-emerald-400 text-xs mb-2">{cookie.name}</div>
                      <p className="text-slate-400 text-xs mb-3">{cookie.purpose}</p>
                      <div className="flex items-center gap-6 text-xs text-slate-500">
                        <span><span className="text-slate-600">Duration:</span> {cookie.duration}</span>
                        <span><span className="text-slate-600">Provider:</span> {cookie.provider}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-14 space-y-8 text-sm text-slate-400 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-3">How to Manage Cookies</h2>
            <p>
              You can control and delete cookies through your browser settings. Most browsers allow you to refuse or accept cookies, and to delete cookies that have been set. The process varies by browser:
            </p>
            <ul className="mt-4 space-y-2 text-slate-400">
              <li><strong className="text-slate-300">Chrome:</strong> Settings → Privacy and Security → Cookies and other site data</li>
              <li><strong className="text-slate-300">Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data</li>
              <li><strong className="text-slate-300">Safari:</strong> Preferences → Privacy → Manage Website Data</li>
              <li><strong className="text-slate-300">Edge:</strong> Settings → Cookies and site permissions</li>
            </ul>
            <p className="mt-4 text-slate-500">
              Note: disabling strictly necessary cookies will prevent you from logging in and using the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time. When we make significant changes, we will notify you via the platform and update the &quot;last updated&quot; date above. Continued use of the platform after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">Contact</h2>
            <p>
              For questions about this Cookie Policy or to exercise your rights under UK GDPR, contact us at{' '}
              <a href="mailto:flowenspeech@outlook.com" className="text-emerald-400 hover:underline">flowenspeech@outlook.com</a>.
            </p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
