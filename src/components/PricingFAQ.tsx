'use client';

import { useState } from 'react';

const FAQS = [{"q": "What happens after the seven-day subscription trial?", "a": "Checkout collects a payment card. Unless you cancel, the subscription automatically bills at the price and interval shown at checkout when the trial ends. The three introductory practice sessions are a separate no-card offer."}, {"q": "How do I cancel?", "a": "Use the subscription controls in your dashboard. Review the cancellation and refund terms before subscribing. This page does not promise an automatic refund of unused annual months."}, {"q": "What is the founding price?", "a": "The displayed founding annual plan is \u00a3239.52 per year, equivalent to \u00a319.96 per month. Monthly and other intervals are shown separately. The final checkout price and agreed terms govern your subscription."}, {"q": "Is funding guaranteed?", "a": "No. Access to Work, DSA and NHS approval depends on the relevant provider and your circumstances. Get written approval before committing to a purchase."}, {"q": "What does feedback do?", "a": "It displays acoustic estimates while you practise. It is not a clinical diagnosis or a validated outcome measure. No fixed latency or improvement in fluency is guaranteed."}, {"q": "What about voice data?", "a": "Some features send audio to providers or store session recordings. Do not assume that audio never leaves your device or is never retained. Read the privacy policy for details."}];

export default function PricingFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-16 px-6 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-extrabold text-white mb-3">Common questions</h2>
        <p className="text-slate-400">Everything you need to know before you start.</p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, i) => (
          <div
            key={i}
            className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40 hover:border-slate-700 transition-colors"
          >
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={open === i}
            >
              <span className="font-semibold text-white text-sm md:text-base">{faq.q}</span>
              <span
                className={`flex-shrink-0 w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 transition-transform duration-200 ${
                  open === i ? 'rotate-45 border-emerald-500 text-emerald-400' : ''
                }`}
                aria-hidden
              >
                +
              </span>
            </button>

            {open === i && (
              <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed border-t border-slate-800/60 pt-4">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-slate-400 text-sm mt-10">
        Still have questions?{' '}
        <a href="mailto:hello@flowen.digital" className="text-emerald-400 hover:text-emerald-300 transition-colors">
          hello@flowen.digital
        </a>
      </p>
    </section>
  );
}
