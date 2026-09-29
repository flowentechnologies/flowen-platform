import MarketingNavbar from '@/components/MarketingNavbar';
import ManageCookieConsent from '@/components/ManageCookieConsent';
import MarketingFooter from '@/components/MarketingFooter';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MASTER_POLICIES } from '@/app/legal/policies';

export const metadata: Metadata = {
  title: 'Cookie Policy — Flowen',
  description:
    'How Flowen uses necessary, analytics and advertising cookies, and how to change your choice.',
  alternates: { canonical: '/cookie-policy' },
};

// ── Cookie table data ─────────────────────────────────────────────────────────

interface CookieRow {
  name: string;
  category: 'strictly-necessary' | 'analytics' | 'advertising' | 'affiliate' | 'third-party';
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
    purpose: 'First-party visitor ID assigned on first visit to count sessions and pageviews. Set before a banner choice.',
    setBy: 'Flowen server (proxy)',
    retention: '30 days (rolling)',
    httpOnly: true,
  },
  {
    name: '__utm',
    category: 'analytics',
    purpose: 'First-party campaign parameters captured when present in a URL, before a banner choice.',
    setBy: 'Flowen server (proxy)',
    retention: '30 days',
    httpOnly: true,
  },
  {
    name: 'flowen_anon_id',
    category: 'analytics',
    purpose: 'First-party attribution ID. Links ad click IDs and visits to downstream conversions. Server-side ad-network sends require Accept all.',
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
    category: 'analytics',
    purpose: 'PostHog product analytics identifiers and sessions, loaded only after Accept all.',
    setBy: 'PostHog JS (browser)',
    retention: '1 year (distinct ID) / session',
    httpOnly: false,
  },
  {
    name: 'flowen_cookie_consent',
    category: 'strictly-necessary',
    purpose: 'Stores your choice (all or necessary) so it persists across visits; a matching server record is also saved.',
    setBy: 'Flowen browser',
    retention: '1 year',
    httpOnly: false,
  },
  {
    name: 'Provider cookies (Google, Meta, Snapchat, LinkedIn)',
    category: 'advertising',
    purpose: 'May be set by advertising pixels and remarketing tags after Accept all; actual names and lifetimes depend on each provider.',
    setBy: 'Advertising providers',
    retention: 'Provider-dependent',
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
  'analytics':          { label: 'Analytics', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  'advertising':        { label: 'Advertising', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
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
            Last updated <strong className="text-slate-300">29 September 2026</strong>.
            We believe cookie policies should be readable — this one is.
            Below are the main cookies and tracking tools we use, alongside the full policy.
          </p>
        </div>

        {/* Quick summary banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">TL;DR</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {[
              { icon: '✓', color: 'text-emerald-400', text: 'Authentication and the cookie-choice record work without Accept all' },
              { icon: '✓', color: 'text-emerald-400', text: 'Our server also sets first-party visit and attribution IDs before a choice' },
              { icon: '✓', color: 'text-emerald-400', text: 'PostHog and GA4 start only after Accept all' },
              { icon: '✓', color: 'text-emerald-400', text: 'Advertising pixels and remarketing tags start only after Accept all' },
              { icon: '✓', color: 'text-emerald-400', text: 'Change your choice below at any time' },
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
          <h2 className="text-xl font-bold text-white">Cookies and similar technology</h2>

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
          <ManageCookieConsent />
          <div className="space-y-3 text-sm text-slate-400 leading-relaxed">
            <p>
              <strong className="text-slate-200">Browser settings:</strong> Block or delete cookies in your browser settings.
              Blocking strictly necessary cookies may prevent sign-in.
            </p>
            <p>
              <strong className="text-slate-200">Change or withdraw consent:</strong> Use the Change cookie choices button above and choose Necessary only. The choice is saved in a browser cookie and a server record. If you previously accepted all, the page reloads after withdrawal to unload scripts already running in that tab.
            </p>
            <p>
              <strong className="text-slate-200">Existing cookies:</strong> Withdrawing consent prevents further optional tracking in this browser. You can delete existing provider cookies in your browser settings. For questions about first-party visit and attribution data, email <a href="mailto:hello@flowen.digital" className="text-emerald-400 hover:text-emerald-300">hello@flowen.digital</a>.
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
