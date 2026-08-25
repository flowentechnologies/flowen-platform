'use client';

import React, { useState } from 'react';
import Link from 'next/link';

type State = 'idle' | 'loading' | 'error' | 'unavailable';

export default function VerifyIdentityPage() {
  const [state, setState]   = useState<State>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleStart = async () => {
    setState('loading');
    setErrMsg(null);
    try {
      const res  = await fetch('/api/portal/kyc-session', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };

      if (res.status === 503 && data.error === 'not_configured') {
        setState('unavailable');
        return;
      }
      if (!res.ok || !data.url) {
        setErrMsg(data.error ?? 'Verification session could not be created. Please try again.');
        setState('error');
        return;
      }

      // Redirect to Didit's hosted verification flow
      window.location.href = data.url;
    } catch {
      setErrMsg('Could not connect to the verification service. Please try again.');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-6">

        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Identity Verification Required</h1>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            To access your Flowen therapy portal we need to verify your identity. This is a one-time process
            required under UK clinical safety standards (DCB0129) for health-adjacent applications.
          </p>
        </div>

        {/* What we verify */}
        <div className="text-left bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3 text-sm text-slate-300">
          <p className="font-mono text-xs uppercase tracking-widest text-slate-500">What we verify</p>
          <ul className="space-y-2">
            {[
              'Government-issued photo ID (passport or driving licence)',
              'Selfie for liveness detection',
              'Name and date of birth match',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Error states */}
        {state === 'error' && errMsg && (
          <div className="text-left bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-300">
            {errMsg}
          </div>
        )}

        {state === 'unavailable' ? (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 text-sm text-amber-300 text-left space-y-1">
              <p className="font-semibold">Verification temporarily unavailable</p>
              <p className="text-amber-400/70 text-xs">Our identity verification service is being configured. Please contact support and we&apos;ll complete verification manually.</p>
            </div>
            <a
              href="mailto:hello@flowen.digital?subject=Manual%20identity%20verification%20request"
              className="block w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all"
            >
              Contact support →
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            disabled={state === 'loading'}
            className="block w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-950 font-bold text-sm transition-all"
          >
            {state === 'loading' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Starting secure session…
              </span>
            ) : state === 'error' ? 'Try again' : 'Start Verification'}
          </button>
        )}

        <p className="text-xs text-slate-600">
          Verification is powered by{' '}
          <span className="text-slate-500">Didit</span>.
          Your data is processed in accordance with UK GDPR and our{' '}
          <Link href="/legal" className="text-slate-500 hover:text-slate-400 underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
