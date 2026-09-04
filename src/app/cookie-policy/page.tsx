import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MASTER_POLICIES } from '@/app/legal/policies';

export const metadata: Metadata = {
  title: 'Cookie Policy — Flowen',
  description:
    'Full details on every cookie Flowen sets — strictly necessary auth cookies, first-party analytics (__vs, __utm), affiliate tracking, and third-party tools.',
  alternates: { canonical: '/cookie-policy' },
};

// ── Cookie table data ─────────────────────────────────────────────────────────

interface CookieRow {
  name: string;
  category: 'strictly-necessary' | 'analytics' | 'affiliate' | 'third-party';
  purpose: string;
  setBy: string;
  retention: string;
  httpOnly: boolean;
}

const COOKIES: CookieRow[] = [
  {
    name: 'sb-* / *-auth-token*',
    category: 'strictly-necessary',
    purpose: 'Supabase session tokens — keep you signed in. Contains a signed JWT and refresh token.',
    setBy: 'Flowen server (Supabase SSR)',
    retention: 'Session / 1 hour (auto-renewed)',
    httpOnly: true,
  },
  {
    name: '__vs',
    category: 'analytics',
    purpose: 'Visitor session ID. A random UUID assigned on first visit — no personal data. Used to count unique visitors and measure sessions.',
    setBy: 'Flowen server (proxy)',
    retention: '30 days (rolling)',
    httpOnly: true,
  },
  {
    name: '__utm',
    category: 'analytics',
    purpose: 'First-touch UTM parameters (source, medium, campaign, term, content). Only set when UTM params are present in the URL. Never shared with third parties.',
    setBy: 'Flowen server (proxy)',
    retention: '30 days',
    httpOnly: true,
  },
  {
    name: 'flowen_anon_id',
    category: 'analytics',
    purpose: 'Anonymous marketing attribution ID. Links ad click IDs (gclid, fbclid) to conversions via server-side Conversions API. No personal data.',
    setBy: 'Flowen server (proxy)',
    retention: '365 days',
    httpOnly: true,
  },
  {
    name: 'flowen_ref',
    category: 'affiliate',
    purpose: 'Affiliate referral code. Set only when you arrive via a ?ref= link. Stores the partner code (short alphanumeric, not personal data) for commission attribution.',
    setBy: 'Flowen server (proxy)',
    retention: '30 days',
    httpOnly: true,
  },
  {
    name: 'ph_*',
    category: 'third-party',
    purpose: 'PostHog product analytics — distinct ID and session ID for usage funnels (e.g. "session started"). Hosted on our own EU instance.',
    setBy: 'PostHog JS (browser)',
    retention: '1 year (distinct ID) / session',
    httpOnly: false,
  },
  {
    name: '__stripe_mid / __stripe_sid',
    category: 'third-party',
    purpose: 'Stripe fraud prevention and payment flow continuity. Only set on pricing and checkout pages.',
    setBy: 'Stripe JS (browser)',
    retention: '1 year / session',
    httpOnly: false,
  },
];

const CATEGORY_LABELS: Record<CookieRow['category'], { label: string; color: string }> = {
  'strictly-necessary': { label: 'Strictly Necessary', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  'analytics':          { label: 'First-Party Analytics', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  'affiliate':          { label: 'Affiliate / Referral', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  'third-party':        { label: 'Third-Party', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CookiePolicyPage() {
  const policy = MASTER_POLICIES.cookiePolicy;

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-16 space-y-12">

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-slate-400">
            <Link href="/legal" className="hover:text-slate-300 transition-colors">Legal</Link>
            <span>›</span>
            <span>Cookie Policy</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Cookie Policy</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
            Last updated <strong className="text-slate-300">1 August 2026</strong>.
            We believe cookie policies should be readable — this one is.
            Below is every cookie we set, in plain English, alongside the full legal text.
          </p>
        </div>

        {/* Quick summary banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">TL;DR</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              { icon: '✓', color: 'text-emerald-400', text: 'No advertising or cross-site tracking cookies' },
              { icon: '✓', color: 'text-emerald-400', text: 'First-party analytics only — data stays on our servers' },
              { icon: '✓', color: 'text-emerald-400', text: '__vs visitor ID is a random UUID — no personal data' },
              { icon: '✓', color: 'text-emerald-400', text: 'All first-party cookies are HttpOnly — not readable by scripts' },
              { icon: '✓', color: 'text-emerald-400', text: 'We honour the Do Not Track browser signal' },
              { icon: '✓', color: 'text-emerald-400', text: 'You can opt out of analytics by emailing us' },
            ].map(({ icon, color, text }) => (
              <div key={text} className="flex items-start gap-2">
                <span className={`${color} font-bold shrink-0`}>{icon}</span>
                <span className="text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cookie table */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Every cookie we set</h2>

          {/* Category legend */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => (
              <span
                key={key}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${color}`}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  {['Cookie name', 'Category', 'Purpose', 'Set by', 'Retention', 'HttpOnly'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-mono uppercase tracking-widest text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {COOKIES.map(c => {
                  const cat = CATEGORY_LABELS[c.category];
                  return (
                    <tr key={c.name} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-200 whitespace-nowrap align-top">{c.name}</td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${cat.color} whitespace-nowrap`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 leading-relaxed max-w-xs align-top">{c.purpose}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap align-top">{c.setBy}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap align-top">{c.retention}</td>
                      <td className="px-4 py-3 text-center align-top">
                        {c.httpOnly
                          ? <span className="text-emerald-400 text-xs font-bold">Yes</span>
                          : <span className="text-slate-400 text-xs">No</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Opt-out section */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white">Your choices</h2>
          <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
            <p>
              <strong className="text-slate-200">Browser settings:</strong> Block or delete cookies in your browser settings.
              Note: blocking strictly necessary cookies will prevent sign-in.
            </p>
            <p>
              <strong className="text-slate-200">First-party analytics opt-out:</strong> Email{' '}
              <a href="mailto:hello@flowen.digital?subject=Cookie opt-out" className="text-emerald-400 hover:text-emerald-300">
                hello@flowen.digital
              </a>{' '}
              with the subject "Cookie opt-out". We will suppress analytics for your account within 5 working days.
            </p>
            <p>
              <strong className="text-slate-200">Do Not Track:</strong> We honour the DNT browser signal.
              When active, all non-essential cookies and analytics events are suppressed.
            </p>
            <p>
              <strong className="text-slate-200">PostHog:</strong> Opt out via Dashboard → Settings → Privacy, or email us.
            </p>
          </div>
        </section>

        {/* Full legal text */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">Full legal text</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-x-auto">
            <pre className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap font-mono">
              {policy}
            </pre>
          </div>
        </section>

        {/* Related links */}
        <nav className="grid sm:grid-cols-3 gap-4">
          {[
            { href: '/legal', label: 'Privacy Policy', desc: 'Full UK GDPR statement' },
            { href: '/dpa', label: 'Data Processing Agreement', desc: 'For NHS and institutional customers' },
            { href: '/security', label: 'Security & Compliance', desc: 'Technical controls and DCB0129' },
          ].map(({ href, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors group"
            >
              <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{label} →</p>
              <p className="text-xs text-slate-400 mt-1">{desc}</p>
            </Link>
          ))}
        </nav>

      </main>

      <MarketingFooter />
    </div>
  );
}
