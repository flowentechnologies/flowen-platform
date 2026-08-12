import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

export const metadata: Metadata = {
  title: 'Affiliate Programme — Flowen',
  description:
    'Earn recurring commissions by referring clinicians, schools, and individuals to Flowen. Three tiers with up to 15% commission for 12 months.',
};

const TIERS = [
  {
    id:         'standard',
    label:      'Standard',
    commission: '7.5%',
    duration:   '3 months',
    badge:      'bg-slate-800 border border-slate-700 text-slate-300',
    highlight:  false,
    who:        'Content creators, bloggers, and online communities.',
    perks: [
      'Unique referral link + dashboard',
      '7.5% of every subscription payment',
      'Recurring for 3 months per referral',
      'Paid monthly via bank transfer',
    ],
  },
  {
    id:         'premium',
    label:      'Premium',
    commission: '10%',
    duration:   '6 months',
    badge:      'bg-amber-500/10 border border-amber-500/30 text-amber-400',
    highlight:  true,
    who:        'SLT professionals, SEND consultants, and coaches.',
    perks: [
      'Everything in Standard',
      '10% commission per referral',
      'Recurring for 6 months per referral',
      'Priority email support',
    ],
  },
  {
    id:         'partner',
    label:      'Partner',
    commission: '15%',
    duration:   '12 months',
    badge:      'bg-purple-500/10 border border-purple-500/30 text-purple-400',
    highlight:  false,
    who:        'Charities, schools, NHS teams, and resellers.',
    perks: [
      'Everything in Premium',
      '15% commission per referral',
      'Recurring for a full 12 months',
      'Co-marketing & co-branding options',
      'Dedicated partner manager',
    ],
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Apply',
    body:  'Fill in the short form below. We review every application and typically respond within 2 business days.',
  },
  {
    step: '02',
    title: 'Get your link',
    body:  'Once approved you receive a unique referral link and access to your personalised dashboard.',
  },
  {
    step: '03',
    title: 'Share & earn',
    body:  'Share your link with your audience. Each paying subscriber earns you recurring commission for the full duration of your tier.',
  },
  {
    step: '04',
    title: 'Get paid',
    body:  'Commissions are totalled monthly and paid directly to your bank account. No minimum threshold.',
  },
];

export default function AffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string; error?: string; info?: string }>;
}) {
  // searchParams is a Promise in Next.js 15+ — unwrap synchronously via use() or read statically
  // We read the raw object; Next coerces it at build boundary.
  const params = searchParams as unknown as { applied?: string; error?: string; info?: string };

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 font-sans antialiased">
      <MarketingNavbar />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6">
          Affiliate Programme
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-5 leading-tight">
          Earn by helping people find their voice
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Refer individuals, clinicians, and organisations to Flowen and earn recurring commission
          for every subscriber you bring in — up to <span className="text-white font-semibold">15%</span> for
          a full year per referral.
        </p>
        <a
          href="#apply"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
        >
          Apply now
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-white text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <div key={step} className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-6">
              <span className="text-3xl font-black text-emerald-500/30 leading-none block mb-3">{step}</span>
              <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tiers */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-white text-center mb-4">Commission tiers</h2>
        <p className="text-slate-500 text-sm text-center mb-12 max-w-xl mx-auto">
          All tiers earn recurring commissions on Flowen subscriptions (currently £19.95–£79.99/mo).
          Tier upgrades are reviewed quarterly based on performance.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map(tier => (
            <div
              key={tier.id}
              className={`relative rounded-2xl p-7 flex flex-col gap-5 ${
                tier.highlight
                  ? 'bg-[#0A0D14] border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                  : 'bg-[#0A0D14] border border-slate-800'
              }`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-black">
                    Most popular
                  </span>
                </div>
              )}
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold mb-3 ${tier.badge}`}>
                  {tier.label}
                </span>
                <div className="flex items-end gap-1.5 mb-1">
                  <span className="text-4xl font-extrabold text-white">{tier.commission}</span>
                  <span className="text-slate-400 text-sm mb-1.5">/ subscription</span>
                </div>
                <p className="text-xs text-slate-500">Recurring for {tier.duration} per referral</p>
              </div>
              <p className="text-xs text-slate-400 italic">{tier.who}</p>
              <ul className="space-y-2 flex-1">
                {tier.perks.map(perk => (
                  <li key={perk} className="flex items-start gap-2 text-xs text-slate-300">
                    <svg className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {perk}
                  </li>
                ))}
              </ul>
              <a
                href="#apply"
                className={`mt-auto block text-center py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  tier.highlight
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                Apply for {tier.label}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ strip */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-white text-center mb-10">Common questions</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Who can join?',
              a: 'Anyone with an audience that overlaps with our users — speech therapists, SEND educators, coaches, bloggers, charities, and NHS teams. We review every application individually.',
            },
            {
              q: 'When and how do I get paid?',
              a: 'Commissions are totalled at the end of each calendar month and paid by bank transfer (UK) or SWIFT (international). There is no minimum payout threshold.',
            },
            {
              q: 'How is a referral tracked?',
              a: 'Your unique link sets a first-party cookie valid for 30 days. If someone signs up and subscribes within that window, the conversion is attributed to you.',
            },
            {
              q: 'Can I be upgraded to a higher tier?',
              a: 'Yes. Tier upgrades are reviewed quarterly. If your referral volume or audience quality qualifies you for Premium or Partner, we\'ll reach out proactively.',
            },
            {
              q: 'Do commissions stack with discounts?',
              a: 'Commissions are calculated on the actual amount collected, after any promotional discount the subscriber used.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-2">{q}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Apply form */}
      <section id="apply" className="max-w-2xl mx-auto px-6 pb-32">
        <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-8 md:p-10">

          {/* Success state */}
          {params.applied === '1' ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Application received</h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Thanks for applying. We review every application personally and will reply to your
                email within 2 business days.
              </p>
              <Link
                href="/"
                className="inline-block text-xs text-slate-500 hover:text-emerald-400 transition-colors"
              >
                ← Back to home
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-2 text-center">Apply to join</h2>
              <p className="text-xs text-slate-500 text-center mb-8">
                We review every application and reply within 2 business days.
              </p>

              {/* Error banner */}
              {params.error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                  {params.error}
                </div>
              )}

              {/* Info banner (duplicate / suspended) */}
              {params.info && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
                  {params.info}
                </div>
              )}

              <form action="/api/affiliate/apply" method="POST" className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Full name
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Jane Smith"
                      className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="jane@example.com"
                      className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Tier you&apos;re applying for
                  </label>
                  <select
                    name="tier"
                    defaultValue="standard"
                    className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white focus:outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value="standard">Standard — 7.5% / 3 months</option>
                    <option value="premium">Premium — 10% / 6 months</option>
                    <option value="partner">Partner — 15% / 12 months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    How will you promote Flowen?
                  </label>
                  <textarea
                    name="promotion_method"
                    required
                    rows={4}
                    placeholder="e.g. SLT podcast with 3,000 listeners, SEND school network of 80 schools, YouTube channel..."
                    className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Website / social / channel URL{' '}
                    <span className="text-slate-600 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="url"
                    name="url"
                    placeholder="https://"
                    className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
                >
                  Submit application
                </button>

                <p className="text-[11px] text-slate-600 text-center">
                  By applying you agree to the{' '}
                  <Link href="/legal" className="underline hover:text-slate-400 transition-colors">
                    Flowen Affiliate Terms
                  </Link>
                  {' '}(part of our Terms of Service).
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
