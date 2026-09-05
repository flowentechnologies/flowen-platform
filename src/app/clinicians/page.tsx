import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';
import { CliniciansForm } from './CliniciansForm';

export const metadata: Metadata = {
  title: 'For Speech & Language Therapists — Flowen',
  description:
    'Flowen gives your patients structured daily practice with real-time acoustic biofeedback between appointments, and gives you remote visibility of every session. Apply for the SLT beta programme.',
  alternates: { canonical: 'https://www.flowen.digital/clinicians' },
  openGraph: {
    title: 'Flowen for Speech & Language Therapists',
    description:
      'See every session, not just the ones in your diary. Real-time biofeedback between appointments, caseload portal for remote monitoring.',
    url: 'https://www.flowen.digital/clinicians',
  },
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-semibold tracking-widest text-emerald-400 uppercase">
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-500 mb-3">
      {children}
    </p>
  );
}

// ── Portal features ───────────────────────────────────────────────────────────

const PORTAL_FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    title: 'Caseload overview',
    body: 'All your patients in one dashboard — current stage, last session date, streak, and fluency trend at a glance.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'Session telemetry',
    body: 'Per-session fluency scores, disfluency event counts, blocked events, and smoothed speech rate — automatically computed from the acoustic signal.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    title: 'Exercise assignment',
    body: 'Customise the programme per patient. Progress them through stages, assign specific techniques, and set weekly targets.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: 'Progress reports',
    body: 'Exportable session summaries ready for clinical notes or MDT handover — no manual data entry from paper diaries.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
    ),
    title: 'Missed session alerts',
    body: 'Get notified when a patient misses their practice streak — intervene early rather than waiting for the next appointment.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    title: 'Clinical safety flags',
    body: 'Automatic flags for sessions where distress markers or abnormal acoustic patterns are detected — review before the patient reaches out.',
  },
];

// ── Governance items ──────────────────────────────────────────────────────────

const GOVERNANCE = [
  {
    label: 'DCB0129',
    title: 'Clinical Safety Standard',
    body: 'Hazard identification and risk mitigation in compliance with NHS England\'s mandatory clinical safety standard for health IT systems.',
  },
  {
    label: 'RCSLT',
    title: 'RCSLT-Aligned Techniques',
    body: 'Fluency shaping, stuttering modification (Van Riper), and hybrid approaches. All techniques grounded in RCSLT clinical guidance and peer-reviewed evidence.',
  },
  {
    label: 'UK GDPR',
    title: 'UK Data Residency',
    body: 'All patient data processed on UK/EU infrastructure. Supabase Frankfurt + Vercel EU edge. Full sub-processor list in our DPA.',
  },
  {
    label: 'DTAC',
    title: 'DTAC Submission In Progress',
    body: 'Digital Technology Assessment Criteria evidence pack in preparation for NHS England evaluation — covering all five DTAC domains.',
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Does Flowen replace SLT sessions?',
    a: 'No. Flowen is a supervised adjunct — it handles structured daily practice between your appointments, not instead of them. You remain the clinician of record, you set the programme, and you review the data.',
  },
  {
    q: 'What fluency techniques does it cover?',
    a: 'The current programme covers five stages built around fluency shaping techniques: breath support, easy onset, light contacts, pausing, and conversational flow. Stuttering modification pathways are in development for the next version.',
  },
  {
    q: 'What does "beta" mean in practice?',
    a: 'You\'ll get early access before public launch, up to 10 patient slots at no cost, and a direct line to the clinical and engineering team. We expect rough edges — that\'s the point. Your feedback shapes the product.',
  },
  {
    q: 'What data will I actually receive?',
    a: 'Session-level acoustic telemetry: fluency score, disfluency event counts (blocks, prolongations, repetitions), smoothed speech rate, and session duration. Plus streak data and stage completion across the programme.',
  },
  {
    q: 'Is it safe to use with my patients?',
    a: 'Flowen is developed under DCB0129 Clinical Safety governance. It is not a medical device — it is a speech practice aid. Patient consent, appropriate patient selection, and your clinical oversight remain your responsibility as the supervising SLT.',
  },
  {
    q: 'Can I use it with children?',
    a: 'The current programme is designed for adults (16+). A paediatric-appropriate version is planned but not in scope for the initial beta. If your caseload is primarily children, we\'d still love to hear from you — your input will shape that roadmap.',
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CliniciansPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-white">
      <MarketingNavbar />
      <main id="main-content">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="mt-16 h-96 w-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
          <Tag>For Speech &amp; Language Therapists</Tag>

          <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
            See every session.{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Not just the ones in your diary.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Flowen gives your patients structured daily practice with real-time acoustic biofeedback between appointments — and gives you remote visibility of every session they complete.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#apply"
              className="px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
            >
              Apply for SLT Beta →
            </a>
            <Link
              href="/whitepaper"
              className="px-7 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium text-sm transition-colors"
            >
              Read the whitepaper
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <section className="border-y border-slate-800/60 bg-slate-900/30">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: 'Sub-80ms', label: 'audio pipeline latency' },
            { value: '5 stages', label: 'evidence-based programme' },
            { value: '10 exercises', label: 'per stage, auto-rotated' },
            { value: '10 patients', label: 'per SLT, free in beta' },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-2xl font-extrabold text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-400 leading-snug">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Problem / Solution ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Problem */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mb-4">The gap between sessions</p>
            <h2 className="text-2xl font-bold text-white mb-5 leading-snug">
              Patients practise alone.<br />Without feedback.
            </h2>
            <ul className="space-y-4">
              {[
                'Homework exercises are done in silence — no way to know if technique is being applied correctly.',
                'Bad habits form between sessions without acoustic feedback to reinforce correct patterns.',
                'You rely on self-report: "I practised three times." You have no visibility of what actually happened.',
                'Momentum built in the clinic evaporates over seven days without supported practice.',
              ].map(item => (
                <li key={item} className="flex gap-3 text-sm text-slate-400 leading-relaxed">
                  <span className="mt-0.5 shrink-0 text-rose-400/70">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Solution */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8">
            <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-500 mb-4">Flowen between sessions</p>
            <h2 className="text-2xl font-bold text-white mb-5 leading-snug">
              Every session logged.<br />Every pattern visible.
            </h2>
            <ul className="space-y-4">
              {[
                'Real-time acoustic biofeedback reinforces technique on every practice repetition — not just in the clinic.',
                'The app runs a sub-80ms audio pipeline and surfaces detected blocks, prolongations, and repetitions within 300ms end-to-end.',
                'You see the telemetry — fluency scores, event counts, session duration — for every home practice session.',
                'Missed practice triggers an alert to you before it becomes a missed appointment.',
              ].map(item => (
                <li key={item} className="flex gap-3 text-sm text-slate-300 leading-relaxed">
                  <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Portal features ───────────────────────────────────────────────── */}
      <section className="bg-slate-900/30 border-y border-slate-800/60">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <SectionLabel>The SLT Portal</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Your caseload. In one place.
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base leading-relaxed">
              The clinician portal gives you full visibility of every patient's programme — without them having to remember to bring their notes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PORTAL_FEATURES.map(f => (
              <div
                key={f.title}
                className="bg-[#06080F] border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Clinical governance ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <SectionLabel>Clinical Governance</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Built for regulated clinical use.
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto text-base leading-relaxed">
            Flowen is designed for NHS and regulated private practice environments from the ground up — not retrofitted after the fact.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {GOVERNANCE.map(g => (
            <div key={g.label} className="flex gap-5 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <span className="shrink-0 mt-0.5 px-2 py-0.5 h-fit rounded bg-slate-800 border border-slate-700 font-mono text-xs font-bold text-slate-400">
                {g.label}
              </span>
              <div>
                <h3 className="font-semibold text-white mb-1.5">{g.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{g.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/resources/nhs-procurement"
            className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors underline underline-offset-4"
          >
            Read the full NHS ICB Procurement Guide →
          </Link>
        </div>
      </section>

      {/* ── Beta programme ────────────────────────────────────────────────── */}
      <section className="bg-slate-900/30 border-y border-slate-800/60">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <SectionLabel>Beta Programme</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5">
            10 SLTs. 10 patients each.<br className="hidden sm:block" /> Free throughout.
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-base leading-relaxed mb-12">
            We're selecting the first cohort of 10 Speech &amp; Language Therapists to shape Flowen's clinical programme before public launch. You get early access, free patient slots, and a direct line to the team. We get real-world clinical feedback.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
            {[
              {
                step: '01',
                title: 'Apply',
                body: 'Submit a short application below. We review in order received and aim to respond within 5–7 working days.',
              },
              {
                step: '02',
                title: 'Onboard',
                body: 'We walk you through the portal, help you enrol your first patients, and give you a direct Slack channel to the clinical team.',
              },
              {
                step: '03',
                title: 'Shape it',
                body: 'Your feedback — what\'s missing, what\'s confusing, what matters clinically — directly influences the product roadmap.',
              },
            ].map(s => (
              <div key={s.step} className="bg-[#06080F] border border-slate-800 rounded-2xl p-6">
                <p className="text-3xl font-black text-emerald-400 mb-3">{s.step}</p>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <SectionLabel>Common Questions</SectionLabel>
          <h2 className="text-3xl font-bold text-white">Answered honestly.</h2>
        </div>

        <div className="space-y-4">
          {FAQ.map(item => (
            <details
              key={item.q}
              className="group bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none select-none hover:bg-slate-800/40 transition-colors">
                <span className="font-medium text-white text-sm">{item.q}</span>
                <span className="shrink-0 text-slate-400 group-open:rotate-45 transition-transform duration-200 text-xl leading-none">+</span>
              </summary>
              <div className="px-6 pb-5 text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-4">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── Application form ──────────────────────────────────────────────── */}
      <section id="apply" className="bg-slate-900/30 border-t border-slate-800/60">
        <div className="max-w-2xl mx-auto px-6 py-20">
          <div className="text-center mb-10">
            <SectionLabel>Apply Now</SectionLabel>
            <h2 className="text-3xl font-bold text-white mb-3">Join the SLT Beta</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Applications close when the first 10 cohort spots are filled.
              No payment details required — free throughout beta.
            </p>
          </div>
          <CliniciansForm />
        </div>
      </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
