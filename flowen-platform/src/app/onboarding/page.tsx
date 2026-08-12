'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/app/actions/complete-onboarding';
import posthog from 'posthog-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface State {
  name: string;
  role: string;
  duration: string;          // how long stammering
  challenges: string[];      // multi-select situations
  currentSupport: string;    // therapy history
  fundingPath: string;       // employer / student / nhs / self
}

type RecommendationType = 'funded_atw' | 'funded_dsa' | 'funded_nhs' | 'standard' | 'clinician' | 'researcher';

interface Recommendation {
  type: RecommendationType;
  headline: string;
  subline: string;
  badge: string;
  badgeColor: string;
  features: string[];
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  {
    value: 'pwds',
    label: 'I stammer / stutter',
    desc: 'Looking to build fluency through daily acoustic practice',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
      </svg>
    ),
  },
  {
    value: 'parent_carer',
    label: 'Parent or carer',
    desc: 'Supporting a child or family member who stammers',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/>
      </svg>
    ),
  },
  {
    value: 'clinician',
    label: 'Speech & language therapist',
    desc: 'Using Flowen with clients in a clinical or institutional setting',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
      </svg>
    ),
  },
  {
    value: 'researcher',
    label: 'Researcher or academic',
    desc: 'Investigating fluency technology, speech biofeedback, or outcomes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.5 2.798H8.298"/>
      </svg>
    ),
  },
  {
    value: 'other',
    label: 'Other',
    desc: 'Something else — we\'ll personalise as we go',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
      </svg>
    ),
  },
];

const DURATIONS = [
  { value: 'recent',   label: 'Just recently', sub: 'Less than a year' },
  { value: '1_5yrs',  label: 'A few years', sub: '1–5 years' },
  { value: '5plus',   label: 'Most of my life', sub: '5+ years' },
];

const CHALLENGES = [
  { value: 'work_presentations', label: 'Work presentations' },
  { value: 'job_interviews',     label: 'Job interviews' },
  { value: 'phone_calls',        label: 'Phone calls' },
  { value: 'social_situations',  label: 'Social situations' },
  { value: 'meeting_people',     label: 'Meeting new people' },
  { value: 'daily_conversations', label: 'Daily conversations' },
];

const FUNDING_PATHS = [
  {
    value: 'employer',
    label: 'Through my employer',
    sub: 'Access to Work can cover 100% of the cost',
    badge: 'Employer funded',
    color: 'border-emerald-500/50 bg-emerald-500/5 text-emerald-300',
  },
  {
    value: 'student',
    label: 'As a university student',
    sub: "Disabled Students' Allowance (DSA) funding",
    badge: 'DSA funded',
    color: 'border-sky-500/50 bg-sky-500/5 text-sky-300',
  },
  {
    value: 'nhs',
    label: 'Referred by an NHS therapist',
    sub: 'NHS ICB or clinic-funded programme',
    badge: 'NHS referred',
    color: 'border-blue-500/50 bg-blue-500/5 text-blue-300',
  },
  {
    value: 'self',
    label: 'Paying personally / exploring',
    sub: 'Subscription or free trial',
    badge: null,
    color: 'border-slate-600 bg-transparent text-slate-300',
  },
];

// ─── Recommendation logic ─────────────────────────────────────────────────────

function deriveRecommendation(state: State): Recommendation {
  const { role, fundingPath } = state;

  if (role === 'clinician') {
    return {
      type: 'clinician',
      headline: 'NHS & Institutional Access',
      subline: "You're joining as a clinician. Flowen integrates with NHS ICB procurement and DTAC-compliant workflows.",
      badge: 'CLINICAL',
      badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      features: ['Clinician dashboard', 'Patient session monitoring', 'DTAC-compliant data', 'DCB0129 documentation'],
      primaryLabel: 'Go to clinician dashboard →',
      primaryHref: '/dashboard/clinician',
    };
  }

  if (role === 'researcher') {
    return {
      type: 'researcher',
      headline: 'Research & Academic Access',
      subline: 'Interested in the evidence base or research collaboration? Our team would love to hear from you.',
      badge: 'RESEARCH',
      badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
      features: ['Access to anonymised aggregate data', 'API access on request', 'Academic licensing', 'Evidence base documentation'],
      primaryLabel: 'Get in touch →',
      primaryHref: '/#contact',
      secondaryLabel: 'Explore the platform',
      secondaryHref: '/dashboard',
    };
  }

  if (fundingPath === 'employer') {
    return {
      type: 'funded_atw',
      headline: 'Funded Access via Access to Work',
      subline: 'Great news — as an employed person, your employer or the government can cover the full cost of Flowen through the Access to Work scheme.',
      badge: 'FUNDED',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      features: ['All Standard features included', 'SLT progress monitoring', 'Funding application guide included', '£0 to you — employer/grant pays'],
      primaryLabel: 'Read the Access to Work guide →',
      primaryHref: '/resources/access-to-work',
      secondaryLabel: 'Go to dashboard first',
      secondaryHref: '/dashboard',
    };
  }

  if (fundingPath === 'student') {
    return {
      type: 'funded_dsa',
      headline: "Funded Access via DSA",
      subline: "As a UK university student, Disabled Students' Allowance (DSA) can fund Flowen entirely. Most DSA assessors approve assistive speech technology.",
      badge: 'FUNDED',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      features: ['All Standard features included', 'SLT progress monitoring', 'DSA evidence pack included', '£0 to you — DSA pays'],
      primaryLabel: 'Read the DSA guide →',
      primaryHref: '/resources/dsa-guide',
      secondaryLabel: 'Go to dashboard first',
      secondaryHref: '/dashboard',
    };
  }

  if (fundingPath === 'nhs') {
    return {
      type: 'funded_nhs',
      headline: 'NHS Funded Access',
      subline: "Your therapist or NHS ICB can procure Flowen on your behalf under the DTAC framework. We'll support the paperwork.",
      badge: 'NHS',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      features: ['All Standard features included', 'SLT monitoring dashboard', 'DTAC/DCB0129 documentation', '£0 to you if NHS funded'],
      primaryLabel: 'NHS procurement guide →',
      primaryHref: '/resources/nhs-procurement',
      secondaryLabel: 'Go to dashboard first',
      secondaryHref: '/dashboard',
    };
  }

  // Self-funded / other
  return {
    type: 'standard',
    headline: 'Standard Access',
    subline: "The full Flowen experience — real-time acoustic biofeedback, your 8-week programme, and fluency analytics — for less than a coffee a day.",
    badge: 'STANDARD',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    features: ['Unlimited practice sessions', 'Real-time acoustic biofeedback', '8-week guided programme', 'Fluency progress analytics'],
    primaryLabel: 'Start Standard Access — £19.99/mo →',
    primaryHref: '/pricing',
    secondaryLabel: 'Try for free first',
    secondaryHref: '/dashboard',
  };
}

// ─── Step components ──────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i + 1 <= step ? 'bg-emerald-500' : 'bg-slate-800'
          }`}
        />
      ))}
      <span className="text-[10px] font-mono text-slate-600 shrink-0 ml-1">
        {step}/{total}
      </span>
    </div>
  );
}

function StepWrapper({ children, step, total, onBack }: {
  children: React.ReactNode;
  step: Step;
  total: number;
  onBack?: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <ProgressBar step={step} total={total} />
        {children}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-6 text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/>
            </svg>
            Back
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<State>({
    name: '',
    role: '',
    duration: '',
    challenges: [],
    currentSupport: '',
    fundingPath: '',
  });

  const isStammerer = ['pwds', 'parent_carer'].includes(state.role);
  const totalSteps: number = (isStammerer || step < 2) ? 5 : 4;

  // Map internal step (1/2/4/5 for non-stammerers) to a visible display step
  function displayStep(s: Step): Step {
    if (isStammerer || s <= 2) return s;
    if (s === 4) return 3 as Step;
    if (s === 5) return 4 as Step;
    return s;
  }

  function patch(partial: Partial<State>) {
    setState(prev => ({ ...prev, ...partial }));
  }

  function toggleChallenge(val: string) {
    setState(prev => ({
      ...prev,
      challenges: prev.challenges.includes(val)
        ? prev.challenges.filter(c => c !== val)
        : [...prev.challenges, val],
    }));
  }

  function nextStep() {
    setError(null);
    if (step === 2 && !['pwds', 'parent_carer'].includes(state.role)) {
      // Skip the stammer experience step for non-PWS roles
      setStep(4);
    } else {
      setStep(s => Math.min(s + 1, 5) as Step);
    }
  }

  function prevStep() {
    setError(null);
    if (step === 4 && !['pwds', 'parent_carer'].includes(state.role)) {
      // Skip back over step 3 for non-PWS
      setStep(2);
    } else {
      setStep(s => Math.max(s - 1, 1) as Step);
    }
  }

  const rec = deriveRecommendation(state);

  function handleComplete(href: string) {
    if (!gdprConsent) {
      setError('Please accept the data processing terms to continue.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const { error: actionError } = await completeOnboarding({
        displayName: state.name.trim(),
        role: state.role,
        consentAt: new Date().toISOString(),
      });
      if (actionError) { setError(actionError); return; }
      posthog.capture('onboarding_completed', {
        role: state.role,
        funding_path: state.fundingPath,
        recommendation: rec.type,
        challenges: state.challenges,
        duration: state.duration,
      });
      document.cookie = 'flowen_ob=1; path=/; max-age=31536000; SameSite=Lax';
      router.push(href);
    });
  }

  // ─── Step 1: Name ───────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <StepWrapper step={displayStep(step)} total={totalSteps}>
        <div className="space-y-8">
          <div>
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
              Welcome to Flowen
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">
              What should we call you?
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              Just your first name — we&apos;ll personalise your experience from here.
            </p>
          </div>

          <div>
            <input
              type="text"
              autoFocus
              value={state.name}
              onChange={e => patch({ name: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter' && state.name.trim()) nextStep(); }}
              placeholder="Your first name"
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="button"
            disabled={!state.name.trim()}
            onClick={nextStep}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-all"
          >
            Continue →
          </button>
        </div>
      </StepWrapper>
    );
  }

  // ─── Step 2: Role ───────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <StepWrapper step={displayStep(step)} total={totalSteps} onBack={prevStep}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Hi {state.name} — what brings you here?
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              This shapes your experience from day one.
            </p>
          </div>

          <div className="space-y-2">
            {ROLES.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => { patch({ role: r.value }); nextStep(); }}
                className={`w-full text-left px-5 py-4 rounded-2xl border transition-all flex items-start gap-4 group ${
                  state.role === r.value
                    ? 'bg-emerald-500/10 border-emerald-500/60'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${state.role === r.value ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                  {r.icon}
                </span>
                <span>
                  <span className={`block text-sm font-semibold ${state.role === r.value ? 'text-emerald-300' : 'text-white'}`}>
                    {r.label}
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">{r.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </StepWrapper>
    );
  }

  // ─── Step 3: Stammer experience (PWS/parent only) ──────────────────────────
  if (step === 3) {
    return (
      <StepWrapper step={displayStep(step)} total={totalSteps} onBack={prevStep}>
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Tell us about your experience
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              We use this to set a baseline and calibrate your programme.
            </p>
          </div>

          {/* Duration */}
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
              How long have you been stammering?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => patch({ duration: d.value })}
                  className={`py-3 px-2 rounded-xl border text-center transition-all ${
                    state.duration === d.value
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="block text-xs font-semibold">{d.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{d.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Challenges */}
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
              Where does it affect you most? <span className="normal-case tracking-normal text-slate-600">(pick any)</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CHALLENGES.map(c => {
                const selected = state.challenges.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleChallenge(c.value)}
                    className={`py-2.5 px-3 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-2 ${
                      selected
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      selected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                    }`}>
                      {selected && (
                        <svg className="w-2.5 h-2.5 text-slate-950" viewBox="0 0 12 12" fill="currentColor">
                          <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z"/>
                        </svg>
                      )}
                    </span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={nextStep}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all"
          >
            Continue →
          </button>
          <button type="button" onClick={nextStep} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Skip this step
          </button>
        </div>
      </StepWrapper>
    );
  }

  // ─── Step 4: Funding path ───────────────────────────────────────────────────
  if (step === 4) {
    return (
      <StepWrapper step={displayStep(step)} total={totalSteps} onBack={prevStep}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              How are you accessing Flowen?
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              Many users pay £0 — we want to make sure you know your options.
            </p>
          </div>

          <div className="space-y-2">
            {FUNDING_PATHS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => { patch({ fundingPath: f.value }); nextStep(); }}
                className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                  state.fundingPath === f.value
                    ? f.color
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600 text-slate-300'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="block text-sm font-semibold">{f.label}</span>
                  {f.badge && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {f.badge}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">{f.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </StepWrapper>
    );
  }

  // ─── Step 5: Plan recommendation + GDPR ───────────────────────────────────
  return (
    <StepWrapper step={displayStep(step)} total={totalSteps} onBack={prevStep}>
      <div className="space-y-6">
        <div>
          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${rec.badgeColor} mb-3`}>
            {rec.badge}
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {rec.headline}
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            {rec.subline}
          </p>
        </div>

        {/* Feature list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2.5">
          {rec.features.map(f => (
            <div key={f} className="flex items-center gap-3">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
              </svg>
              <span className="text-sm text-slate-300">{f}</span>
            </div>
          ))}
        </div>

        {/* GDPR consent */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={gdprConsent}
            onChange={e => setGdprConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border border-slate-600 bg-slate-950 accent-emerald-500 flex-shrink-0"
          />
          <span className="text-xs text-slate-400 leading-relaxed">
            I consent to Flowen processing my voice and speech data to provide personalised practice, in accordance with the{' '}
            <a href="/legal" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Privacy Policy</a>
            {' '}and{' '}
            <a href="/legal" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Terms of Service</a>
            . You can withdraw consent at any time from account settings.
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* CTAs */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleComplete(rec.primaryHref)}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-all"
          >
            {isPending ? 'Saving…' : rec.primaryLabel}
          </button>

          {rec.secondaryLabel && rec.secondaryHref && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleComplete(rec.secondaryHref!)}
              className="w-full py-3 rounded-2xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-50 text-sm font-medium transition-all"
            >
              {rec.secondaryLabel}
            </button>
          )}

          {rec.type === 'standard' && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleComplete('/dashboard')}
              className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Continue for free — upgrade any time
            </button>
          )}
        </div>
      </div>
    </StepWrapper>
  );
}
