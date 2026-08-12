'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/app/actions/complete-onboarding';
import posthog from 'posthog-js';

// ─── Types ────────────────────────────────────────────────────────────────────

// Internal step: 1 Name · 2 Role · 3 Stammer (PWS only) · 4 Funding · 5 KYC · 6 Recommendation
type Step = 1 | 2 | 3 | 4 | 5 | 6;

type PostcodeStatus = 'idle' | 'loading' | 'verified' | 'error' | 'manual';

interface State {
  // Core
  name: string;
  role: string;
  // Step 3 (stammer experience) — PWS/parent only
  duration: string;
  challenges: string[];
  // Step 4 (funding)
  fundingPath: string;
  // Step 5 (KYC — personal details)
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  country: string;           // 'GB' | 'IE' | 'OTHER'
  phone: string;             // optional
  contextualField: string;   // employer / university / hcpc / trust name
  // Step 5 (KYC — address)
  postcodeInput: string;     // raw input before lookup
  postcodeStatus: PostcodeStatus;
  postcodeError: string;
  addressPostcode: string;   // normalised after successful lookup
  addressRegion: string;
  addressVerifiedAt: string; // ISO timestamp of successful lookup
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
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
  { value: 'recent',  label: 'Just recently', sub: 'Less than a year' },
  { value: '1_5yrs', label: 'A few years',    sub: '1–5 years' },
  { value: '5plus',  label: 'Most of my life', sub: '5+ years' },
];

const CHALLENGES = [
  { value: 'work_presentations',  label: 'Work presentations' },
  { value: 'job_interviews',      label: 'Job interviews' },
  { value: 'phone_calls',         label: 'Phone calls' },
  { value: 'social_situations',   label: 'Social situations' },
  { value: 'meeting_people',      label: 'Meeting new people' },
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

const COUNTRIES = [
  { value: 'GB',    label: 'United Kingdom' },
  { value: 'IE',    label: 'Republic of Ireland' },
  { value: 'OTHER', label: 'Other country' },
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── KYC contextual field config ─────────────────────────────────────────────

function kycContextField(role: string, fundingPath: string): { label: string; placeholder: string; hint: string } | null {
  if (role === 'clinician') {
    return {
      label: 'HCPC registration number',
      placeholder: 'e.g. TS123456',
      hint: 'Optional — helps us verify your professional status for clinical features',
    };
  }
  if (fundingPath === 'employer') {
    return {
      label: 'Employer name',
      placeholder: 'e.g. Lloyds Banking Group',
      hint: 'The organisation that will submit your Access to Work claim',
    };
  }
  if (fundingPath === 'student') {
    return {
      label: 'University or college',
      placeholder: 'e.g. University of Manchester',
      hint: 'Your DSA assessor will need this to process your application',
    };
  }
  if (fundingPath === 'nhs') {
    return {
      label: 'NHS Trust or clinic name',
      placeholder: 'e.g. South London and Maudsley NHS',
      hint: 'Helps us prepare the procurement documentation for your ICB',
    };
  }
  return null;
}

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
      subline: 'Interested in the evidence base or collaboration? Our team would love to hear from you.',
      badge: 'RESEARCH',
      badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
      features: ['Anonymised aggregate data', 'API access on request', 'Academic licensing', 'Evidence base documentation'],
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
      subline: 'Good news — the UK government can cover the full cost of Flowen through Access to Work. Your employer pays nothing either.',
      badge: 'FUNDED',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      features: ['All Standard features', 'SLT progress monitoring', 'Funding application guide', '£0 to you — government pays'],
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
      subline: "As a UK student, Disabled Students' Allowance can fund Flowen entirely. Most assessors approve speech biofeedback tools.",
      badge: 'FUNDED',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      features: ['All Standard features', 'SLT progress monitoring', 'DSA evidence pack', '£0 to you — DSA pays'],
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
      subline: "Your therapist or NHS ICB can procure Flowen under the DTAC framework. We'll support every step of the paperwork.",
      badge: 'NHS',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      features: ['All Standard features', 'SLT monitoring dashboard', 'DTAC/DCB0129 documentation', '£0 to you if NHS funded'],
      primaryLabel: 'NHS procurement guide →',
      primaryHref: '/resources/nhs-procurement',
      secondaryLabel: 'Go to dashboard first',
      secondaryHref: '/dashboard',
    };
  }
  return {
    type: 'standard',
    headline: 'Standard Access',
    subline: "Real-time acoustic biofeedback, your 8-week programme, and fluency analytics — for less than a coffee a day.",
    badge: 'STANDARD',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    features: ['Unlimited practice sessions', 'Real-time acoustic biofeedback', '8-week guided programme', 'Fluency progress analytics'],
    primaryLabel: 'Start Standard Access — £19.99/mo →',
    primaryHref: '/pricing',
    secondaryLabel: 'Try for free first',
    secondaryHref: '/dashboard',
  };
}

// ─── DOB validation ───────────────────────────────────────────────────────────

function validateDob(day: string, month: string, year: string): { iso: string } | { error: string } {
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return { error: 'Please enter a complete date of birth' };
  if (y < 1900 || y > new Date().getFullYear()) return { error: 'Please enter a valid year of birth' };
  if (m < 1 || m > 12) return { error: 'Please enter a valid month' };
  if (d < 1 || d > 31) return { error: 'Please enter a valid day' };
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { error: 'That date doesn\'t exist — please check' };
  }
  const ageMs = Date.now() - date.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 13) return { error: 'You must be at least 13 years old to create an account' };
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { iso };
}

// ─── Step wrapper components ──────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i + 1 <= current ? 'bg-emerald-500' : 'bg-slate-800'
          }`}
        />
      ))}
      <span className="text-[10px] font-mono text-slate-600 shrink-0 ml-1">
        {current}/{total}
      </span>
    </div>
  );
}

function StepWrapper({ children, displayStep, totalSteps, onBack }: {
  children: React.ReactNode;
  displayStep: number;
  totalSteps: number;
  onBack?: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <ProgressBar current={displayStep} total={totalSteps} />
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
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<State>({
    name: '',
    role: '',
    duration: '',
    challenges: [],
    fundingPath: '',
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    country: 'GB',
    phone: '',
    contextualField: '',
    postcodeInput: '',
    postcodeStatus: 'idle',
    postcodeError: '',
    addressPostcode: '',
    addressRegion: '',
    addressVerifiedAt: '',
    addressLine1: '',
    addressLine2: '',
    addressCity: '',
  });

  // Whether the user has a stammer (determines if step 3 appears)
  const isStammerer = ['pwds', 'parent_carer'].includes(state.role);

  // Total visible steps: 6 for stammerers (includes stammer experience step), 5 for others
  const totalSteps = (isStammerer || step < 2) ? 6 : 5;

  // Map internal step number (1-6, with possible gap at 3 for non-stammerers)
  // to the displayed progress position
  function toDisplay(s: Step): number {
    if (isStammerer || s <= 2) return s;
    // Non-stammerers skip step 3: internal 4→display 3, 5→4, 6→5
    if (s === 4) return 3;
    if (s === 5) return 4;
    if (s === 6) return 5;
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
    setStep(s => {
      // Skip step 3 (stammer experience) for non-stammerers
      if (s === 2 && !isStammerer) return 4;
      return Math.min(s + 1, 6) as Step;
    });
  }

  function prevStep() {
    setError(null);
    setStep(s => {
      // Skip back over step 3 for non-stammerers
      if (s === 4 && !isStammerer) return 2;
      return Math.max(s - 1, 1) as Step;
    });
  }

  const rec = deriveRecommendation(state);
  const ctxField = kycContextField(state.role, state.fundingPath);

  function handleComplete(href: string) {
    if (!gdprConsent) {
      setError('Please accept the data processing terms to continue.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const consentAt = new Date().toISOString();

      // Build DOB ISO string (validated already in step 5)
      let dobIso: string | undefined;
      if (state.dobDay && state.dobMonth && state.dobYear) {
        const result = validateDob(state.dobDay, state.dobMonth, state.dobYear);
        if ('error' in result) { setError(result.error); return; }
        dobIso = result.iso;
      }

      const { error: actionError } = await completeOnboarding({
        displayName:         state.name.trim(),
        role:                state.role,
        consentAt,
        dateOfBirth:         dobIso,
        countryOfResidence:  state.country || 'GB',
        phoneNumber:         state.phone || undefined,
        // Route contextual field to the right column
        employerName:        (state.role !== 'clinician' && state.fundingPath === 'employer') ? state.contextualField || undefined : undefined,
        hcpcNumber:          state.role === 'clinician' ? state.contextualField || undefined : undefined,
        institutionName:     (['student','nhs'].includes(state.fundingPath) && state.role !== 'clinician') ? state.contextualField || undefined : undefined,
        marketingConsent,
        // Address
        addressLine1:        state.addressLine1 || undefined,
        addressLine2:        state.addressLine2 || undefined,
        addressCity:         state.addressCity || undefined,
        addressPostcode:     state.addressPostcode || undefined,
        addressRegion:       state.addressRegion || undefined,
        addressVerifiedAt:   state.addressVerifiedAt || undefined,
      });

      if (actionError) { setError(actionError); return; }

      posthog.capture('onboarding_completed', {
        role:              state.role,
        funding_path:      state.fundingPath,
        recommendation:    rec.type,
        challenges:        state.challenges,
        duration:          state.duration,
        country:           state.country,
        has_dob:           !!dobIso,
        has_phone:         !!state.phone,
        has_contextual:    !!state.contextualField,
        marketing_consent: marketingConsent,
        has_address:       !!state.addressLine1,
        address_verified:  state.postcodeStatus === 'verified',
      });

      document.cookie = 'flowen_ob=1; path=/; max-age=31536000; SameSite=Lax';
      router.push(href);
    });
  }

  // ─── Step 1: Name ────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <StepWrapper displayStep={1} totalSteps={totalSteps}>
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
          <input
            type="text"
            autoFocus
            value={state.name}
            onChange={e => patch({ name: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' && state.name.trim()) nextStep(); }}
            placeholder="Your first name"
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-xl text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
          />
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
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

  // ─── Step 2: Role ─────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <StepWrapper displayStep={toDisplay(step)} totalSteps={totalSteps} onBack={prevStep}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Hi {state.name} — what brings you here?
            </h1>
            <p className="text-slate-400 text-sm mt-2">This shapes your experience from day one.</p>
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

  // ─── Step 3: Stammer experience (PWS/parent only) ─────────────────────────
  if (step === 3) {
    return (
      <StepWrapper displayStep={toDisplay(step)} totalSteps={totalSteps} onBack={prevStep}>
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
              Where does it affect you most?{' '}
              <span className="normal-case tracking-normal text-slate-600">(pick any)</span>
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

          <button type="button" onClick={nextStep} className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all">
            Continue →
          </button>
          <button type="button" onClick={nextStep} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors">
            Skip this step
          </button>
        </div>
      </StepWrapper>
    );
  }

  // ─── Step 4: Funding path ────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <StepWrapper displayStep={toDisplay(step)} totalSteps={totalSteps} onBack={prevStep}>
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

  // ─── Step 5: KYC ─────────────────────────────────────────────────────────────
  if (step === 5) {
    async function lookupPostcode() {
      const raw = state.postcodeInput.trim();
      if (!raw) return;
      patch({ postcodeStatus: 'loading', postcodeError: '' });
      try {
        const res = await fetch(`/api/kyc/postcode?postcode=${encodeURIComponent(raw)}`);
        const json = await res.json();
        if (json.valid) {
          patch({
            postcodeStatus:    'verified',
            addressPostcode:   json.postcode,
            addressRegion:     json.region ?? '',
            addressVerifiedAt: new Date().toISOString(),
            postcodeError:     '',
          });
        } else {
          patch({ postcodeStatus: 'error', postcodeError: json.error ?? 'Postcode not found' });
        }
      } catch {
        patch({ postcodeStatus: 'error', postcodeError: 'Could not reach postcode service — enter address manually below' });
      }
    }

    function handleKycNext() {
      setError(null);
      // Validate DOB if any part is entered
      if (state.dobDay || state.dobMonth || state.dobYear) {
        const result = validateDob(state.dobDay, state.dobMonth, state.dobYear);
        if ('error' in result) { setError(result.error); return; }
      }
      // Phone is optional but must be plausible if given
      if (state.phone && !/^[+\d\s\-().]{7,20}$/.test(state.phone)) {
        setError('Please enter a valid phone number, or leave it blank');
        return;
      }
      // Address line 1 is required if the user started filling in an address
      if ((state.postcodeStatus === 'verified' || state.postcodeStatus === 'manual') && !state.addressLine1.trim()) {
        setError('Please enter your first line of address');
        return;
      }
      nextStep();
    }

    return (
      <StepWrapper displayStep={toDisplay(step)} totalSteps={totalSteps} onBack={prevStep}>
        <div className="space-y-7">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              A few details about you
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              Required for age verification and funding eligibility. Stored securely under UK GDPR.
            </p>
          </div>

          {/* Date of birth */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
              Date of birth <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={state.dobDay}
                  onChange={e => patch({ dobDay: e.target.value })}
                  placeholder="DD"
                  min={1} max={31}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm text-center placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition tabular-nums"
                />
                <span className="block text-[10px] text-slate-600 text-center mt-1">Day</span>
              </div>
              <div>
                <select
                  value={state.dobMonth}
                  onChange={e => patch({ dobMonth: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/60 transition appearance-none text-center"
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
                <span className="block text-[10px] text-slate-600 text-center mt-1">Month</span>
              </div>
              <div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={state.dobYear}
                  onChange={e => patch({ dobYear: e.target.value })}
                  placeholder="YYYY"
                  min={1900} max={new Date().getFullYear()}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white text-sm text-center placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition tabular-nums"
                />
                <span className="block text-[10px] text-slate-600 text-center mt-1">Year</span>
              </div>
            </div>
          </div>

          {/* Country of residence */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-slate-500 mb-3">
              Country of residence <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COUNTRIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => patch({ country: c.value })}
                  className={`py-3 px-2 rounded-xl border text-center text-xs font-semibold transition-all ${
                    state.country === c.value
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {state.country === 'OTHER' && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 mt-3">
                Access to Work and NHS funding pathways are currently UK-only. Standard subscription is available in all countries.
              </p>
            )}
          </div>

          {/* Phone number (optional) */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">
              Phone number <span className="text-slate-600 normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={state.phone}
              onChange={e => patch({ phone: e.target.value })}
              placeholder="+44 7700 000000"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
            />
            <p className="text-[11px] text-slate-600 mt-1.5">
              Used for Access to Work coordination and clinical support only — never for marketing without consent.
            </p>
          </div>

          {/* Contextual field based on role + funding path */}
          {ctxField && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-slate-500 mb-2">
                {ctxField.label} <span className="text-slate-600 normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={state.contextualField}
                onChange={e => patch({ contextualField: e.target.value })}
                placeholder={ctxField.placeholder}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
              />
              <p className="text-[11px] text-slate-600 mt-1.5">{ctxField.hint}</p>
            </div>
          )}

          {/* ── Address ──────────────────────────────────────────────────────── */}
          <div className="border-t border-slate-800 pt-6 space-y-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-slate-500">
                Home address <span className="text-slate-600 normal-case tracking-normal">(optional)</span>
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Required for Access to Work and DSA funding applications.
              </p>
            </div>

            {/* Postcode lookup */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2">
                Postcode
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  value={state.postcodeInput}
                  onChange={e => patch({
                    postcodeInput: e.target.value.toUpperCase(),
                    // Reset verification when user edits
                    postcodeStatus: 'idle',
                    addressPostcode: '',
                    addressRegion: '',
                    addressVerifiedAt: '',
                  })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupPostcode(); } }}
                  placeholder="e.g. SW1A 1AA"
                  className={`flex-1 bg-slate-900 border rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-slate-600 focus:outline-none transition ${
                    state.postcodeStatus === 'verified'
                      ? 'border-emerald-500/60'
                      : state.postcodeStatus === 'error'
                      ? 'border-red-500/50'
                      : 'border-slate-700 focus:border-emerald-500/60'
                  }`}
                />
                <button
                  type="button"
                  onClick={lookupPostcode}
                  disabled={!state.postcodeInput.trim() || state.postcodeStatus === 'loading'}
                  className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-all whitespace-nowrap"
                >
                  {state.postcodeStatus === 'loading' ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : 'Verify'}
                </button>
              </div>

              {/* Postcode status feedback */}
              {state.postcodeStatus === 'verified' && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-2">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                  </svg>
                  Postcode verified{state.addressRegion ? ` · ${state.addressRegion}` : ''}
                </p>
              )}
              {state.postcodeStatus === 'error' && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] text-red-400">{state.postcodeError}</p>
                  <button
                    type="button"
                    onClick={() => patch({ postcodeStatus: 'manual', postcodeError: '' })}
                    className="text-[11px] text-slate-500 hover:text-slate-300 underline transition-colors"
                  >
                    Enter address manually instead
                  </button>
                </div>
              )}
            </div>

            {/* Address fields — shown after successful lookup or manual mode */}
            {(state.postcodeStatus === 'verified' || state.postcodeStatus === 'manual') && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={state.addressLine1}
                  onChange={e => patch({ addressLine1: e.target.value })}
                  placeholder="Address line 1"
                  autoFocus
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
                />
                <input
                  type="text"
                  value={state.addressLine2}
                  onChange={e => patch({ addressLine2: e.target.value })}
                  placeholder="Address line 2 (optional)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
                />
                <input
                  type="text"
                  value={state.addressCity}
                  onChange={e => patch({ addressCity: e.target.value })}
                  placeholder="Town or city"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
                />
                {state.postcodeStatus === 'manual' && (
                  <input
                    type="text"
                    value={state.postcodeInput}
                    onChange={e => patch({ postcodeInput: e.target.value.toUpperCase(), addressPostcode: e.target.value.toUpperCase() })}
                    placeholder="Postcode"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition"
                  />
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="button"
            disabled={!state.dobDay || !state.dobMonth || !state.dobYear}
            onClick={handleKycNext}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-all"
          >
            Continue →
          </button>
        </div>
      </StepWrapper>
    );
  }

  // ─── Step 6: Plan recommendation + consent ───────────────────────────────────
  return (
    <StepWrapper displayStep={toDisplay(step)} totalSteps={totalSteps} onBack={prevStep}>
      <div className="space-y-6">
        <div>
          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold border ${rec.badgeColor} mb-3`}>
            {rec.badge}
          </span>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {rec.headline}
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">{rec.subline}</p>
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

        {/* Consent block */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Your consents</p>

          {/* GDPR — required */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={gdprConsent}
              onChange={e => setGdprConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border border-slate-600 bg-slate-950 accent-emerald-500 shrink-0"
            />
            <span className="text-xs text-slate-400 leading-relaxed">
              <span className="text-white font-medium">Data processing (required) — </span>
              I consent to Flowen processing my voice and speech data to provide personalised practice, under{' '}
              <a href="/legal" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">UK GDPR and our Privacy Policy</a>.
              You can withdraw consent at any time from account settings.
            </span>
          </label>

          {/* Marketing — optional */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={e => setMarketingConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border border-slate-600 bg-slate-950 accent-emerald-500 shrink-0"
            />
            <span className="text-xs text-slate-400 leading-relaxed">
              <span className="text-white font-medium">Research & updates (optional) — </span>
              Receive occasional product updates, evidence summaries, and research insights. Unsubscribe anytime.
            </span>
          </label>
        </div>

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
