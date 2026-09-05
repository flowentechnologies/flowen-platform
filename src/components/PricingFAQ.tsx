'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: 'What happens after the 7-day free trial?',
    a: "Nothing happens automatically until you confirm. At the end of your trial you'll be prompted to choose a billing plan. If you don't, your account simply reverts to the free waitlist tier — no charge, no surprise. We ask for card details at checkout so we can activate the trial instantly, but we won't take payment until you choose to continue.",
  },
  {
    q: 'Can I really cancel any time?',
    a: "Yes, unconditionally. Cancel from your dashboard in under 30 seconds — no phone calls, no retention chat, no questions. You keep access until the end of your current billing period. If you're on annual billing and cancel within 30 days, email us and we'll refund the unused months.",
  },
  {
    q: 'What does the founding member price lock actually mean?',
    a: "Once you subscribe as a founding member, your rate is fixed — permanently. We can increase prices for future subscribers, but your invoice will always show the rate you joined at. This is a contractual commitment, not a marketing promise. The rate lock survives plan upgrades and continues for as long as you remain subscribed.",
  },
  {
    q: 'Is Flowen eligible for NHS, Access to Work, or DSA funding?',
    a: "Yes. Flowen is designed to work alongside funded pathways. If you have an Access to Work award, your employer reimburses the cost. DSA-eligible students can claim Flowen as an assistive technology. For NHS-commissioned use, your clinician can refer directly via the institutional pathway — contact hello@flowen.digital. We provide invoices and receipts suitable for all three routes.",
  },
  {
    q: 'How does the AI actually work?',
    a: "Flowen captures your voice in real time, analyses acoustic patterns associated with fluency disruption — voice tension, block onset, prolongations, repetitions — through a sub-80ms audio pipeline, with pattern detection resolving within 300ms end-to-end. You practise targeted speech techniques with the AI responding as you speak. It's the equivalent of having a biofeedback instrument available 24/7, without a clinic visit.",
  },
  {
    q: 'What devices does it work on?',
    a: "Flowen works in any modern browser (Chrome, Safari, Firefox, Edge) on desktop or laptop. A native iOS app is in development under our Apple Developer membership. Android follows shortly after. A stable internet connection and a microphone are the only requirements.",
  },
  {
    q: 'Is my voice data private?',
    a: "Voice audio is processed in real time for biofeedback — it is not stored as a recording. We retain only derived acoustic metrics (fluency indices, tension scores) linked to your session, with full encryption at rest and in transit. You can request a complete data export or deletion at any time under GDPR / UK GDPR. See our Privacy Policy for full detail.",
  },
  {
    q: 'Why is the founding member price so much lower?',
    a: "Early subscribers carry more risk — the product is newer, the ecosystem is smaller. In exchange for joining before Flowen is widely known, you get a permanently lower rate and a direct line to shape the product. We're also in early-stage infrastructure scaling, so the founding cohort helps us grow sustainably. Once founding slots close, pricing moves to standard rates.",
  },
];

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
