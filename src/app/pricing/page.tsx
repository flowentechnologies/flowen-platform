import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import PricingSection from '@/components/Pricing';
import PricingFAQ from '@/components/PricingFAQ';
import { JsonLd } from '@/components/JsonLd';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Flowen Speech Platform',
  description: 'Start free for 7 days. Real-time AI speech biofeedback for people who stutter. No card required. From £19.96/mo for founding members.',
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
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
      <main className="flex-1">

        {/* ── Conversion hero ── */}
        <section className="pt-16 pb-4 px-6 max-w-3xl mx-auto text-center">
          {/* Urgency eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Founding Member Cohort — Early rate, price locked for life
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4" style={{ textWrap: 'balance' }}>
            Try it free for 7 days.{' '}
            <span className="text-emerald-400">No card required.</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-8">
            Real-time AI speech biofeedback for people who stutter. Start today — no waiting lists, no appointments, no referral needed.
          </p>

          {/* Trust signals */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-500 mb-2">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> 7-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> No card today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Cancel any time
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> NHS & DSA eligible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> DCB0129 compliant
            </span>
          </div>
        </section>

        {/* ── Pricing tiers ── */}
        <PricingSection />

        {/* ── Social proof bar ── */}
        <section className="py-10 px-6 border-t border-slate-800/60">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-slate-500 text-sm mb-6 uppercase tracking-widest font-semibold">Designed to work alongside</p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-slate-400 text-sm font-medium">
              <span>NHS Speech Therapy</span>
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
              7-day free trial. Full access from day one. No card until you decide to stay.
            </p>
            <a
              href="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition-all hover:scale-105 shadow-xl shadow-emerald-500/20"
            >
              🚀 Start your free trial
            </a>
            <p className="text-xs text-slate-600 mt-4">No card required · Cancel any time · Founding rate locks in when you subscribe</p>
          </div>
        </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
