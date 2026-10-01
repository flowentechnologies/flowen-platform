import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import PricingSection from '@/components/Pricing';
import PricingFAQ from '@/components/PricingFAQ';
import { JsonLd } from '@/components/JsonLd';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Flowen Speech Platform',
  description: 'Three introductory sessions without a card. A separate seven-day subscription trial collects a card and bills automatically unless cancelled. Review pricing at checkout.',
  alternates: {
    canonical: '/pricing',
  },
};

const VALID_CYCLES = ['monthly', 'quarterly', 'six_months', 'yearly'] as const;
type BillingCycle = typeof VALID_CYCLES[number];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawCycle = typeof sp.cycle === 'string' ? sp.cycle : undefined;
  const initialCycle: BillingCycle = VALID_CYCLES.includes(rawCycle as BillingCycle)
    ? (rawCycle as BillingCycle)
    : 'yearly';

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://flowen.digital' },
          { '@type': 'ListItem', 'position': 2, 'name': 'Pricing', 'item': 'https://flowen.digital/pricing' },
        ],
      }} />
      <MarketingNavbar />
      <main id="main-content" className="flex-1">

        {/* ── Conversion hero ── */}
        <section className="pt-16 pb-4 px-6 max-w-3xl mx-auto text-center">
          {/* Urgency eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Founding Member Cohort - Review terms at checkout
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4" style={{ textWrap: 'balance' }}>
            Try three practice sessions.{' '}
            <span className="text-emerald-400">No card required.</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-8">
            Real-time AI speech biofeedback for people who stutter. Start today — no waiting lists, no appointments, no referral needed.
          </p>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> 7-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Card collected for subscription trial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Cancel any time
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Funding subject to approval
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Safety documents are drafts
            </span>
          </div>
        </section>

        {/* ── Value anchor: your first 7 days ── */}
        <section className="py-14 px-6 max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-500 mb-2">What you get</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white" style={{ textWrap: 'balance' }}>
              Your first 7 days, mapped out
            </h2>
          </div>
          <div className="relative">
            {/* Vertical connector line */}
            <div className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent hidden sm:block" />
            <div className="space-y-6">
              {[
                {
                  day: 'Day 1',
                  color: 'emerald',
                  title: 'First session - Explore live feedback',
                  body: 'Use microphone-based feedback while you practise. Signal quality depends on device permissions, microphone and environment. Automated readings are estimates, not clinical measurements.',
                },
                {
                  day: 'Days 2–4',
                  color: 'sky',
                  title: 'Your patterns start to surface',
                  body: 'Review practice activity across the available exercise stages. Changes in automated scores do not establish clinical improvement.',
                },
                {
                  day: 'Days 5–6',
                  color: 'violet',
                  title: 'Consistent practice builds the streak',
                  body: 'Most members who reach day 5 have already noticed a shift — not just in metrics, but in how they approach speaking situations. The streak tracker keeps you accountable without pressure.',
                },
                {
                  day: 'Day 7',
                  color: 'amber',
                  title: 'Your first progress report',
                  body: 'Review session activity and estimated practice metrics. No clinical improvement or validated before-and-after outcome is promised.',
                },
              ].map(({ day, color, title, body }) => (
                <div key={day} className="flex gap-5 sm:gap-7">
                  <div className="shrink-0 flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[10px] font-extrabold font-mono z-10 ${
                      color === 'emerald' ? 'bg-emerald-950 border-emerald-500/70 text-emerald-400' :
                      color === 'sky'     ? 'bg-sky-950    border-sky-500/70    text-sky-400'     :
                      color === 'violet'  ? 'bg-violet-950 border-violet-500/70 text-violet-400'  :
                                            'bg-amber-950  border-amber-500/70  text-amber-400'
                    }`}>
                      {day.replace('Day ', '').replace('Days ', '')}
                    </div>
                  </div>
                  <div className="pb-2">
                    <p className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${
                      color === 'emerald' ? 'text-emerald-500' :
                      color === 'sky'     ? 'text-sky-500'     :
                      color === 'violet'  ? 'text-violet-500'  :
                                            'text-amber-500'
                    }`}>{day}</p>
                    <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Value anchor: member voices ── */}
        <section className="py-10 px-6 border-t border-slate-800/40">
          <div className="max-w-4xl mx-auto">
            <p className="text-[11px] font-mono uppercase tracking-widest text-slate-400 text-center mb-8">What members say</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  quote: 'After 8 weeks I went from dreading calls to leading them. The AI feedback is genuinely useful — not generic.',
                  name: 'James R.',
                  detail: '14-day streak · Software engineer',
                  initials: 'JR',
                  color: 'emerald',
                },
                {
                  quote: "I tried apps before but nothing gave me actual data about my speech. Seeing the block rate drop from 8.4 to 3.1 in three weeks kept me going.",
                  name: 'Priya M.',
                  detail: '21-day streak · University student',
                  initials: 'PM',
                  color: 'violet',
                },
                {
                  quote: 'The 5-minute sessions fit into my lunch break. I\'ve done 40+ sessions now and the difference in my confidence at work is real.',
                  name: 'Daniel K.',
                  detail: '30-day streak · Sales manager',
                  initials: 'DK',
                  color: 'sky',
                },
              ].map(({ quote, name, detail, initials, color }) => (
                <blockquote key={name} className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-5 flex flex-col justify-between gap-4">
                  <p className="text-slate-300 text-sm leading-relaxed italic">&ldquo;{quote}&rdquo;</p>
                  <footer className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold border ${
                      color === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                      color === 'violet'  ? 'bg-violet-500/15  border-violet-500/30  text-violet-400'  :
                                            'bg-sky-500/15     border-sky-500/30     text-sky-400'
                    }`}>{initials}</div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200 leading-tight">{name}</p>
                      <p className="text-[11px] text-slate-400 leading-tight">{detail}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-3 h-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                        </svg>
                      ))}
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>

            {/* Clinical badge */}
            <div className="mt-6 flex items-center justify-center gap-3 bg-sky-950/30 border border-sky-800/30 rounded-2xl px-5 py-3 max-w-xl mx-auto">
              <svg className="w-7 h-7 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 6.628 5.373 12 12 12s12-5.372 12-12c0-2.049-.513-3.978-1.418-5.664L12 2.714z" />
              </svg>
              <p className="text-xs text-sky-300/80 leading-snug">
                <strong className="text-sky-200">Clinical assurance not claimed</strong> — clinical approval and NHS assessment require separate evidence
              </p>
            </div>
          </div>
        </section>

        {/* ── Section bridge ── */}
        <div className="py-6 px-6 text-center">
          <p className="text-slate-400 text-sm">
            Three introductory sessions are separate from the seven-day subscription trial.{' '}
            <span className="text-slate-300 font-medium">Card required for the subscription trial; billing starts automatically unless cancelled.</span>
          </p>
        </div>

        {/* ── Pricing tiers ── */}
        <PricingSection initialCycle={initialCycle} />

        {/* ── Social proof bar ── */}
        <section className="py-10 px-6 border-t border-slate-800/60">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-slate-400 text-sm mb-6 uppercase tracking-widest font-semibold">Designed to work alongside</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-slate-400 text-sm font-medium">
              <span>Speech practice</span>
              <span className="text-slate-700">·</span>
              <span>Access to Work</span>
              <span className="text-slate-700">·</span>
              <span>Disabled Students Allowance (DSA)</span>
              <span className="text-slate-700">·</span>
              <span>Private SLT referrals</span>
              <span className="text-slate-700">·</span>
              <span>Self-managed practice</span>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <PricingFAQ />

        {/* ── Bottom CTA ── */}
        <section className="py-20 px-6 border-t border-slate-800/60">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold text-white mb-4" style={{ textWrap: 'balance' }}>
              Ready to start? It takes 60 seconds.
            </h2>
            <p className="text-slate-400 mb-8">
              7-day free trial. Review the features included in your selected plan. Card required for the subscription trial; billing starts automatically unless cancelled.
            </p>
            <a
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition-all hover:scale-105 shadow-xl shadow-emerald-500/20"
            >
              🚀 Start your free trial
            </a>
            <p className="text-xs text-slate-400 mt-4">Card required for subscription trial · Automatic billing unless cancelled · Review terms at checkout</p>
          </div>
        </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
