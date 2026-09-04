'use client';

import React, { useState, useTransition, useRef } from 'react';
import { applySlpBeta } from '@/app/actions/apply-slp-beta';
import posthog from 'posthog-js';

const CASELOAD_OPTIONS = [
  { value: '',       label: 'Select caseload size…' },
  { value: '1–10',   label: '1–10 patients' },
  { value: '11–30',  label: '11–30 patients' },
  { value: '31–50',  label: '31–50 patients' },
  { value: '50+',    label: '50+ patients' },
];

const GROUP_OPTIONS = [
  { value: '',         label: 'Select client group…' },
  { value: 'adults',   label: 'Adults' },
  { value: 'children', label: 'Children & young people' },
  { value: 'both',     label: 'Both' },
];

const inputClass =
  'w-full bg-[#06080F] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white ' +
  'focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-500';

const labelClass = 'block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2';

export function CliniciansForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const payload = {
      name:          fd.get('name')          as string,
      email:         fd.get('email')         as string,
      organisation:  fd.get('organisation')  as string,
      caseload_size: fd.get('caseload_size') as string,
      client_group:  fd.get('client_group')  as string,
      motivation:    fd.get('motivation')    as string,
    };

    startTransition(async () => {
      const result = await applySlpBeta(payload);
      if (result.success) {
        setSubmitted(true);
        posthog.capture('slp_beta_applied', {
          organisation: payload.organisation,
          caseload_size: payload.caseload_size,
          client_group: payload.client_group,
        });
      } else {
        setError(result.message);
      }
    });
  }

  if (submitted) {
    return (
      <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-10 text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Application received</h3>
        <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
          We review applications in the order they arrive. Expect a decision within{' '}
          <span className="text-emerald-400 font-medium">5–7 working days</span> — check your inbox (including spam) for a confirmation email from{' '}
          <span className="font-mono text-slate-300">clinical@flowen.digital</span>.
        </p>
        <div className="pt-2 space-y-1.5 text-xs text-slate-400">
          <p>✓ Confirmation email sent to your work address</p>
          <p>✓ First 10 SLTs accepted get up to 10 free patient slots</p>
          <p>✓ Direct access to the Flowen clinical team throughout</p>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="slt-name" className={labelClass}>Full name</label>
          <input id="slt-name" name="name" type="text" required placeholder="Dr. Jane Smith"
            className={inputClass} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="slt-email" className={labelClass}>Work email</label>
          <input id="slt-email" name="email" type="email" required placeholder="j.smith@nhs.net"
            className={inputClass} autoComplete="email" />
        </div>
      </div>

      <div>
        <label htmlFor="slt-org" className={labelClass}>Organisation</label>
        <input id="slt-org" name="organisation" type="text" required
          placeholder="e.g. Manchester University NHS FT, independent practice…"
          className={inputClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="slt-caseload" className={labelClass}>Caseload size</label>
          <select id="slt-caseload" name="caseload_size" required defaultValue=""
            className={`${inputClass} cursor-pointer`}>
            {CASELOAD_OPTIONS.map(o => (
              <option key={o.value} value={o.value} disabled={o.value === ''}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="slt-group" className={labelClass}>Primary client group</label>
          <select id="slt-group" name="client_group" required defaultValue=""
            className={`${inputClass} cursor-pointer`}>
            {GROUP_OPTIONS.map(o => (
              <option key={o.value} value={o.value} disabled={o.value === ''}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="slt-motivation" className={labelClass}>
          Why do you want to join the beta?{' '}
          <span className="text-slate-500 normal-case not-italic">(optional)</span>
        </label>
        <textarea id="slt-motivation" name="motivation" rows={3}
          placeholder="Tell us about your current approach to home practice and what you're hoping Flowen can improve…"
          className={`${inputClass} resize-none leading-relaxed`} />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-sm tracking-wide transition-all hover:scale-[1.01] shadow-lg shadow-emerald-500/20"
      >
        {isPending ? 'Submitting…' : 'Apply for Beta Access →'}
      </button>

      <p className="text-center text-xs text-slate-500">
        We're selecting the first 10 SLTs. Free throughout beta. No patient billing setup required.
      </p>
    </form>
  );
}
