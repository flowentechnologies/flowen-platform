import Image from 'next/image';
import Link from 'next/link';
import MarketingNavbar from '@/components/MarketingNavbar';
import MarketingFooter from '@/components/MarketingFooter';

const STEPS = [
  {
    number: '01',
    title: 'Create your account',
    description:
      'Join the waitlist and receive your personalised invitation link. Sign up takes under 60 seconds — no credit card required.',
    screenshot: '/assets/screenshots/auth-signup.jpg',
    alt: 'Flowen sign-up screen',
  },
  {
    number: '02',
    title: 'Set up your profile',
    description:
      'Tell us your role and goals. PWS, clinician, researcher or carer — Flowen personalises your experience from day one.',
    screenshot: '/assets/screenshots/onboarding.jpg',
    alt: 'Flowen onboarding screen',
  },
  {
    number: '03',
    title: 'Begin daily practice',
    description:
      'Work through 5 progressive therapy stages with 10 rotating exercises each. Built around evidence-based techniques: breath support, easy onset, light contacts, pausing, and conversational flow.',
    screenshot: '/assets/screenshots/dashboard-practice.jpg',
    alt: 'Flowen daily practice dashboard',
  },
  {
    number: '04',
    title: 'Track your progress',
    description:
      'Every session is logged. See your fluency trends, session streaks, and stage completion over time in your personal analytics dashboard.',
    screenshot: '/assets/screenshots/dashboard-analytics.jpg',
    alt: 'Flowen analytics dashboard',
  },
  {
    number: '05',
    title: 'Clinical review',
    description:
      'Your assigned Speech & Language Therapist monitors your telemetry remotely, adjusts your programme, and reviews session data — all within the platform.',
    screenshot: '/assets/screenshots/clinician.jpg',
    alt: 'Flowen clinician review interface',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#06080F] text-white">
      <MarketingNavbar />
      <main id="main-content">

      {/* Header */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-6">
          <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
            How it works
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Your journey to{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            fluent speech
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Flowen guides you through a structured, evidence-based programme — from
          your first login to ongoing clinical support. Here is how it works.
        </p>
      </section>

      {/* Steps */}
      <section className="max-w-7xl mx-auto px-6 pb-24 space-y-24">
        {STEPS.map((step, index) => {
          const isOdd = index % 2 === 0; // 0-indexed: steps 1,3,5 → text left
          return (
            <div
              key={step.number}
              className={`flex flex-col ${
                isOdd ? 'md:flex-row' : 'md:flex-row-reverse'
              } items-center gap-12 md:gap-16`}
            >
              {/* Screenshot — always on top in mobile */}
              <div className="w-full md:w-1/2 order-first md:order-none">
                <Image
                  src={step.screenshot}
                  alt={step.alt}
                  width={1280}
                  height={800}
                  className="w-full rounded-2xl border border-slate-800 shadow-2xl"
                />
              </div>

              {/* Text */}
              <div className="w-full md:w-1/2 flex flex-col gap-4">
                <span
                  className="text-7xl font-black bg-gradient-to-br from-emerald-400 to-cyan-500 bg-clip-text text-transparent leading-none select-none"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">
                  {step.title}
                </h2>
                <p className="text-base text-slate-400 leading-relaxed max-w-lg">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800/80 bg-[#04050A]">
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to start?
          </h2>
          <p className="text-slate-400 mb-10 text-lg">
            Join thousands of people already working towards fluent, confident
            speech with Flowen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/waitlist"
              className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all hover:scale-105 shadow-md shadow-emerald-500/20"
            >
              Join the waitlist
            </Link>
            <Link
              href="/auth/signup"
              className="px-8 py-3.5 rounded-xl border border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-white font-semibold text-sm transition-all"
            >
              Create an account
            </Link>
          </div>
        </div>
      </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
