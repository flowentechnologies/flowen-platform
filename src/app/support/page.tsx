'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import MarketingNavbar from '@/components/MarketingNavbarClient';
import MarketingFooter from '@/components/MarketingFooter';

const FAQS = [
  {
    q: 'How do I start a practice session on iOS?',
    a: 'Open the Flowen app and tap Practice in the navigation bar. Select a stage, then tap Start Session. Flowen listens to your microphone in real time and provides instant disfluency feedback.',
  },
  {
    q: 'What does Flowen detect during a session?',
    a: 'Flowen detects three types of disfluency: blocks (moments where speech is held back), repetitions (sounds or syllables repeated), and prolongations (drawn-out sounds). After each session you see your counts and how they trend over time.',
  },
  {
    q: 'Is my voice data stored or shared?',
    a: 'No. Audio is processed on-device and is never uploaded, stored, or shared. Only anonymised acoustic metrics (disfluency counts, session duration) are saved to your account under strict clinical data governance.',
  },
  {
    q: 'How do I connect to my Speech and Language Therapist?',
    a: 'Ask your SLT for their Flowen email address and share yours with them. Once they enrol you, they can see your session history and update your treatment plan. You\'ll see a "Clinician" section appear in your dashboard.',
  },
  {
    q: 'How do I change or cancel my subscription?',
    a: 'On iOS, subscriptions are managed through your Apple ID. Go to Settings → [your name] → Subscriptions → Flowen. Alternatively, email us at hello@flowen.digital and we\'ll assist within one business day.',
  },
  {
    q: 'Can I export or delete my data?',
    a: 'Yes. Under UK GDPR you have the right to data portability (Article 20) and erasure (Article 17). Go to Settings → Account in the app, or email hello@flowen.digital with your request. Deletions are completed within 30 days.',
  },
  {
    q: 'Which iPhones are supported?',
    a: 'Flowen requires iOS 16 or later and an iPhone with a microphone (all iPhones from iPhone 7 onwards). The app is optimised for iPhone 12 and newer.',
  },
  {
    q: 'The microphone isn\'t working — what should I do?',
    a: 'Go to iPhone Settings → Privacy & Security → Microphone and check that Flowen is enabled. If the problem continues, force-quit the app, restart your iPhone, and try again. If it persists, contact us.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-800 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-slate-200 leading-snug">{q}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
        </svg>
      </button>
      {open && (
        <p className="text-sm text-slate-400 pb-4 leading-relaxed pr-8">{a}</p>
      )}
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col">
      <MarketingNavbar />

      <main id="main-content" className="flex-1 max-w-4xl mx-auto w-full px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            SUPPORT
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-4 mb-3">
            How can we help?
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            Find answers to common questions below, or get in touch directly.
            We typically respond within 24–48 hours on business days.
          </p>
        </div>

        {/* Quick contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
          {[
            {
              label: 'Email Support',
              desc: 'General questions, billing, and account help.',
              cta: 'hello@flowen.digital',
              href: 'mailto:hello@flowen.digital',
            },
            {
              label: 'Clinical Queries',
              desc: 'SLT collaboration, clinical safety, and NHS questions.',
              cta: 'clinical@flowen.digital',
              href: 'mailto:clinical@flowen.digital',
            },
            {
              label: 'Privacy & Data',
              desc: 'GDPR requests, data exports, right to erasure.',
              cta: 'View our policies →',
              href: '/legal',
            },
          ].map(card => (
            <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-700 transition-colors">
              <div>
                <p className="text-white font-semibold text-sm mb-1">{card.label}</p>
                <p className="text-slate-400 text-xs leading-snug">{card.desc}</p>
              </div>
              <a
                href={card.href}
                className="mt-auto text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors break-all"
              >
                {card.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Response times */}
        <div className="flex gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 mb-14">
          <svg className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p className="text-slate-400 text-xs leading-relaxed">
            <span className="text-slate-300 font-medium">Response times:</span>{' '}
            Bugs &amp; outages: 4h &nbsp;·&nbsp; Billing: 8h &nbsp;·&nbsp; Technical &amp; clinical: 24h &nbsp;·&nbsp; General: 48h
            <span className="text-slate-500"> (Monday–Friday, UK business hours)</span>
          </p>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-bold text-white mb-6">Frequently asked questions</h2>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6">
            {FAQS.map(faq => (
              <FaqItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>

        {/* Clinical safety note */}
        <div className="mt-10 bg-sky-500/5 border border-sky-500/20 rounded-xl px-5 py-4">
          <p className="text-sky-400 text-sm font-semibold mb-1">Clinical safety</p>
          <p className="text-slate-400 text-xs leading-relaxed">
            Flowen is an adjunct tool and does not replace professional speech and language therapy.
            It is compliant with NHS DCB0129 clinical safety standards. For clinical emergencies or
            urgent medical concerns, contact your healthcare provider or call 999.
            Full clinical safety documentation is available at{' '}
            <Link href="/legal" className="text-sky-400 hover:text-sky-300 underline">flowen.digital/legal</Link>.
          </p>
        </div>

      </main>

      <MarketingFooter />
    </div>
  );
}
