'use client';

import React from 'react';
import Link from 'next/link';

export default function VerifyIdentityPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Identity Verification Required</h1>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            To access your Flowen therapy portal we need to verify your identity. This is a one-time process required
            under UK clinical safety standards (DCB0129) for health-adjacent applications.
          </p>
        </div>

        <div className="text-left bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-3 text-sm text-slate-300">
          <p className="font-semibold text-white text-xs font-mono uppercase tracking-widest text-slate-500">What we verify</p>
          <ul className="space-y-2">
            {[
              'Government-issued photo ID (passport or driving licence)',
              'Selfie for liveness detection',
              'Name and date of birth match',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <a
          href="https://didit.me"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all"
        >
          Start Verification
        </a>

        <p className="text-xs text-slate-600">
          Verification is powered by{' '}
          <a href="https://didit.me" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400 underline">
            Didit
          </a>
          . Your data is processed in accordance with UK GDPR and our{' '}
          <Link href="/legal" className="text-slate-500 hover:text-slate-400 underline">privacy policy</Link>.
        </p>
      </div>
    </div>
  );
}
