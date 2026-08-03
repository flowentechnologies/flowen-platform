import Image from 'next/image';
import Link from 'next/link';

const SECTIONS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    screenshot: '/assets/screenshots/dashboard-home.jpg',
    badge: 'Home',
    description:
      'Your daily overview. Shows your current stage, session streak, fluency score trend, and a one-click button to start today\'s session. Recent sessions are listed below with score and duration.',
    tips: [
      '"Begin Practice" launches your next un-completed exercise in the current stage.',
      '"Start drill" opens the 45-second micro exercise — useful when you only have a moment.',
      'Your fluency score is a 0–100 composite updated after each session.',
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    href: '/dashboard/practice',
    screenshot: '/assets/screenshots/dashboard-practice.jpg',
    badge: 'Core',
    description:
      'Five progressive therapy stages, each with 10 daily-rotating exercises. Exercises advance automatically as you complete them. The stage progress bar shows how far through the current stage you are.',
    tips: [
      'Stages unlock sequentially: complete Stage 1 before Stage 2 becomes available.',
      'Exercises rotate daily so you always see a fresh set — the rotation resets at midnight.',
      'Hit "Skip" if an exercise isn\'t suitable — it won\'t affect your score.',
      'A 30-second minimum session duration is required for a session to be saved.',
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/dashboard/analytics',
    screenshot: '/assets/screenshots/dashboard-analytics.jpg',
    badge: 'Progress',
    description:
      'Your complete 30-day fluency telemetry. The bar chart shows your daily fluency score. The stage completion panel shows progress through all five stages. The activity grid shows which days you practised.',
    tips: [
      'A higher fluency score means smoother, more controlled speech that session.',
      'The 7-day streak badge motivates consistency — daily practice compounds faster than irregular sessions.',
      'Stage completion percentages are based on exercises attempted, not score achieved.',
    ],
  },
  {
    id: 'history',
    label: 'History',
    href: '/dashboard/history',
    screenshot: '/assets/screenshots/dashboard-home.jpg',
    badge: 'Log',
    description:
      'A chronological log of every session you\'ve completed. Filter by stage, date range, or score threshold. Each entry shows the exercise name, stage, duration, and fluency score.',
    tips: [
      'Use History to spot patterns — e.g. which stages consistently yield higher scores.',
      'Sessions shorter than 30 seconds are not recorded.',
    ],
  },
  {
    id: 'micro',
    label: 'Micro Exercises',
    href: '/dashboard/practice/micro',
    screenshot: '/assets/screenshots/practice-micro.jpg',
    badge: '30–60s',
    description:
      'Fifteen targeted drills — each 30 to 60 seconds. Ideal before a meeting, phone call, or stressful situation. No recording required. Categories include breathing reset, jaw release, resonance, and confidence anchoring.',
    tips: [
      'Access micro exercises from the Dashboard "Start drill" shortcut or the Practice page.',
      'These do not count toward stage progression — they are supplementary tools.',
    ],
  },
  {
    id: 'clinician',
    label: 'Clinician View',
    href: '/dashboard/clinician',
    screenshot: '/assets/screenshots/clinician.jpg',
    badge: 'SLT',
    description:
      'Visible only to Speech & Language Therapists. Lists all assigned patients with their current stage, last session date, 7-day fluency score, and status flag. Clicking a patient opens their full telemetry timeline.',
    tips: [
      'Amber "Needs review" flags appear when a patient\'s score drops more than 15 points in a week.',
      'Use the Messages tab to send feedback or schedule a session directly within the platform.',
      'Clinicians do not see the Analytics or History tabs — those are patient-only views.',
    ],
  },
  {
    id: 'settings',
    label: 'Settings & Billing',
    href: '/dashboard/settings',
    screenshot: '/assets/screenshots/dashboard-home.jpg',
    badge: 'Account',
    description:
      'Update your display name, notification preferences, and account email. The Billing section shows your current plan, renewal date, and a button to manage your Stripe subscription.',
    tips: [
      'Magic link sign-in means no password to update — just re-request a link from the login page.',
      'Billing is handled via Stripe — Flowen never stores your card details.',
      'To withdraw GDPR consent, use the "Delete my account" option at the bottom of Settings.',
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

      {/* Header */}
      <div className="mb-12">
        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          PLATFORM GUIDE
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-4">
          How to use Flowen
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          A walkthrough of every section of the platform — what each page does, how to read
          your data, and tips for getting the most from your practice.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-1 rounded-full text-xs font-mono text-slate-400 border border-slate-800 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-20">
        {SECTIONS.map(section => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-5">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
                {section.badge}
              </span>
              <h2 className="text-xl font-bold text-white">{section.label}</h2>
              <Link
                href={section.href}
                className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
              >
                Open →
              </Link>
            </div>

            {/* Annotated screenshot */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-black/40 mb-6 bg-slate-900">
              <Image
                src={section.screenshot}
                alt={`${section.label} screenshot`}
                width={1280}
                height={800}
                className="w-full"
              />
              {/* Badge overlay */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm border border-slate-700 text-xs font-mono text-slate-300">
                {section.label}
              </div>
            </div>

            {/* Description */}
            <p className="text-slate-300 text-sm leading-relaxed mb-5">
              {section.description}
            </p>

            {/* Tips */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <p className="text-xs font-mono uppercase text-emerald-400/70 mb-3 tracking-wider">Tips</p>
              <ul className="space-y-2">
                {section.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
                    <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-20 border-t border-slate-800 pt-10 text-center">
        <p className="text-slate-400 text-sm mb-4">Still have questions?</p>
        <Link
          href="/dashboard/support"
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
