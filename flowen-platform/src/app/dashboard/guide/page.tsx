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
      'Your daily overview. Shows your current programme stage, recent session history, and a one-click button to start a new session. Each session card displays the duration and blocks-per-minute reading.',
    tips: [
      '"Begin Practice" takes you straight to the practice screen for the current stage.',
      'Blocks per minute (BPM) is the core fluency metric — lower is better.',
      'Check Messages to stay in touch with your clinician without leaving the platform.',
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    href: '/dashboard/practice',
    screenshot: '/assets/screenshots/dashboard-practice.jpg',
    badge: 'Core',
    description:
      'Five progressive therapy stages. Record a session, then stop to save your results. The avatar provides real-time visual biofeedback for lip and facial movements. Optional camera face tracking can be enabled for higher-fidelity feedback.',
    tips: [
      'Stages advance automatically once the algorithm detects consistent improvement across sessions.',
      'Enable captions (CC) during a session to see a live transcript of your speech.',
      'A 30-second minimum session duration is required for the session to be saved.',
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/dashboard/analytics',
    screenshot: '/assets/screenshots/dashboard-analytics.jpg',
    badge: 'Progress',
    description:
      'Your 30-day session history visualised. The chart shows blocks-per-minute over time. The activity grid highlights which days you practised. Use this to spot trends and identify your best and worst sessions.',
    tips: [
      'Blocks per minute trending downward is the key signal of improvement.',
      'Regular short sessions compound faster than infrequent long ones.',
      'Filter by date range to focus on a specific period of your programme.',
    ],
  },
  {
    id: 'history',
    label: 'History',
    href: '/dashboard/history',
    screenshot: '/assets/screenshots/dashboard-home.jpg',
    badge: 'Log',
    description:
      'A chronological log of every session you\'ve completed. Filter by stage. Each entry shows the date, stage, duration, total blocks detected, blocks-per-minute, and the intensity bar. Sessions with captions enabled also display their transcript.',
    tips: [
      'Click "View" on any row to expand the full session transcript.',
      'Use the stage filter to compare performance within a single programme stage.',
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
      'Access micro exercises via the Practice page.',
      'These do not count toward stage progression — they are supplementary tools.',
      'Use the breathing reset drill before any high-pressure speaking situation.',
    ],
  },
  {
    id: 'clinician',
    label: 'Clinician View',
    href: '/dashboard/clinician',
    screenshot: '/assets/screenshots/clinician.jpg',
    badge: 'SLT',
    description:
      'Visible only to Speech & Language Therapists. Lists all assigned patients with their current stage, last session date, average blocks-per-minute, and trend direction. Clicking a patient opens their full session history and allows you to write session notes.',
    tips: [
      'Trend indicators (Improving / Plateauing / Regressing) are calculated from the last six sessions.',
      'Use the Messages tab to send feedback or schedule a session directly within the platform.',
      'Treatment plans can be created and updated from each patient\'s profile.',
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
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-4">
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
              className="px-3 py-1 rounded-full text-xs font-mono text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
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
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-mono font-bold uppercase tracking-wider">
                {section.badge}
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{section.label}</h2>
              <Link
                href={section.href}
                className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 font-mono transition-colors"
              >
                Open →
              </Link>
            </div>

            {/* Annotated screenshot */}
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/40 mb-6 bg-white dark:bg-slate-900">
              <Image
                src={section.screenshot}
                alt={`${section.label} screenshot`}
                width={1280}
                height={800}
                className="w-full"
              />
              {/* Badge overlay */}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300">
                {section.label}
              </div>
            </div>

            {/* Description */}
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5">
              {section.description}
            </p>

            {/* Tips */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
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
      <div className="mt-20 border-t border-slate-200 dark:border-slate-800 pt-10 text-center">
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
