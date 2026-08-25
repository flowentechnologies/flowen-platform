'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'How do I start a practice session?',
    a: 'Go to Practice in the navigation bar. Select a stage, then press "Start Session". The engine listens to your microphone in real time and provides instant disfluency feedback.',
  },
  {
    q: 'What does the disfluency score mean?',
    a: 'The engine detects three disfluency types: blocks (airflow interruptions), repetitions (sound or syllable repeats), and prolongations (extended sounds). Lower counts per session indicate improvement.',
  },
  {
    q: 'Is my voice data stored?',
    a: 'By default, only anonymised acoustic metrics (disfluency counts, timing data) are sent to our servers — no raw audio leaves your device during a session. If you have a clinician assigned, session recordings may be stored securely for up to 30 days so your SLP can review your progress. You can review and change your data preferences under Settings → Privacy. All data is processed under UK GDPR and NHS DCB0129 clinical safety standards.',
  },
  {
    q: 'How do I change my subscription?',
    a: 'Go to Dashboard → Settings → Billing & Subscription to manage your plan via the Stripe customer portal. You can upgrade, downgrade, or cancel directly — changes take effect immediately. For manual adjustments, contact support below.',
  },
  {
    q: 'Can I export my session data?',
    a: 'Yes — under UK GDPR Article 20 (Right to Data Portability) you can request a full data export. Submit a ticket with category "Account" and mention "data export request".',
  },
  {
    q: 'What browsers are supported?',
    a: 'Chrome, Edge, and Safari (16+) on desktop. Mobile Chrome and Safari on iOS 16+. Firefox is not recommended due to AudioWorklet limitations.',
  },
  {
    q: 'How do I cancel my account?',
    a: 'Go to Settings → Delete Account. Your data will be anonymised within 30 days per UK GDPR Article 17. You can also email us and we will process it manually within 48 hours.',
  },
];

// ── FAQ item ──────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 dark:border-slate-800 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-slate-900 dark:text-white leading-snug">{q}</span>
        <svg
          className={`w-4 h-4 text-slate-500 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
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

// ── Contact form ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'general',   label: 'General question' },
  { value: 'billing',   label: 'Billing & subscription' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'clinical',  label: 'Clinical / speech therapy' },
  { value: 'account',   label: 'Account & data' },
  { value: 'bug',       label: 'Bug report' },
];

function ContactForm() {
  const [subject,  setSubject]  = useState('');
  const [message,  setMessage]  = useState('');
  const [category, setCategory] = useState('general');
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');
  const [isPending, start]      = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { setError('Please fill in all fields.'); return; }
    setError('');
    start(async () => {
      const res = await fetch('/api/dashboard/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body: message, category }),
      });
      if (res.ok) {
        posthog.capture('support_request_submitted', { category });
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setError(data.error ?? 'Something went wrong. Try emailing us directly.');
      }
    });
  };

  if (sent) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Ticket submitted</h3>
        <p className="text-slate-400 text-sm">We'll reply to your email within 24–48 hours. Check your inbox for a confirmation.</p>
        <button type="button" onClick={() => { setSent(false); setSubject(''); setMessage(''); setCategory('general'); }} className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline">
          Submit another ticket
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
      <h3 className="text-slate-900 dark:text-white font-bold text-base">Send a message</h3>

      <div>
        <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Briefly describe your issue"
          maxLength={200}
          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Message</label>
        <textarea
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe your issue in detail. Include steps to reproduce if reporting a bug."
          maxLength={5000}
          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-y"
        />
        <p className="text-[10px] text-slate-600 mt-1 text-right">{message.length}/5000</p>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded-xl transition-colors text-sm"
      >
        {isPending ? 'Sending…' : 'Send message'}
      </button>

      <p className="text-[10px] text-slate-600 text-center">
        We typically respond within 24–48 hours. For urgent issues email{' '}
        <a href="mailto:hello@flowen.digital" className="text-slate-500 hover:text-slate-300 underline">
          hello@flowen.digital
        </a>
      </p>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-10">

      {/* Header */}
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Support Centre</h1>
        <p className="text-slate-400 text-sm mt-1">Help articles, FAQs, and direct support</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: '📧',
            title: 'Email Support',
            desc: 'Send us a message and we\'ll reply within 24–48 hours.',
            action: 'mailto:hello@flowen.digital',
            label: 'Email us',
            external: true,
          },
          {
            icon: '🔒',
            title: 'Privacy & Data',
            desc: 'GDPR requests, data exports, and account deletion.',
            action: '/dashboard/settings',
            label: 'Go to Settings',
            external: false,
          },
          {
            icon: '📋',
            title: 'Legal Policies',
            desc: 'Privacy policy, cookie policy, terms of service.',
            action: '/legal',
            label: 'View policies',
            external: false,
          },
        ].map(card => (
          <div key={card.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
            <span className="text-3xl">{card.icon}</span>
            <div>
              <p className="text-slate-900 dark:text-white font-semibold text-sm">{card.title}</p>
              <p className="text-slate-500 text-xs mt-1 leading-snug">{card.desc}</p>
            </div>
            {card.external ? (
              <a href={card.action} className="mt-auto text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                {card.label} →
              </a>
            ) : (
              <Link href={card.action} className="mt-auto text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                {card.label} →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* SLA info */}
      <div className="flex gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3.5">
        <span className="text-lg shrink-0">⏱</span>
        <div>
          <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">Response time commitments</p>
          <p className="text-slate-500 text-xs mt-0.5">
            Bugs: 4h · Billing: 8h · Technical & Clinical: 24h · General: 48h (business hours, Monday–Friday)
          </p>
        </div>
      </div>

      {/* Two-column: FAQ + Contact form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Frequently asked questions</h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6">
            {FAQS.map(faq => (
              <FaqItem key={faq.q} {...faq} />
            ))}
          </div>
        </div>

        {/* Contact form */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Contact us</h2>
          <ContactForm />
        </div>
      </div>

      {/* Clinical / accessibility note */}
      <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl px-4 py-4">
        <p className="text-sky-400 text-sm font-medium mb-1">Clinical & accessibility support</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          If you require accommodations, are a speech-language pathologist, or have a clinical query, please select{' '}
          <strong className="text-slate-600 dark:text-slate-300">Clinical / speech therapy</strong> in the contact form or email us directly.
          All clinical communications are handled under NHS DCB0129 clinical safety protocols.
        </p>
      </div>
    </div>
  );
}
