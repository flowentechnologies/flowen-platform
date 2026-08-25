'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const LAUNCH_DATE = new Date('2026-09-02T00:00:00.000Z');

function getTimeLeft() {
  const diff = Math.max(0, LAUNCH_DATE.getTime() - Date.now());
  return {
    days:    Math.floor(diff / 86_400_000),
    hours:   Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className="w-20 h-20 sm:w-28 sm:h-28 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center shadow-xl">
          <span className="text-3xl sm:text-5xl font-black tabular-nums text-white tracking-tight">
            {String(value).padStart(2, '0')}
          </span>
        </div>
      </div>
      <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

export default function ComingSoonPage() {
  const [time, setTime] = useState(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[300px] bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 text-center max-w-lg w-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-10 w-auto">
            <defs>
              <linearGradient id="cs-wave-gradient" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="35%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path d="M 10 25 C 20 25, 25 38, 35 38 C 48 38, 52 12, 65 12 C 78 12, 82 42, 95 42 C 105 42, 108 30, 115 30" stroke="url(#cs-wave-gradient)" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M 10 33 C 20 33, 25 46, 35 46 C 48 46, 52 20, 65 20 C 78 20, 82 50, 95 50 C 105 50, 108 38, 115 38" stroke="url(#cs-wave-gradient)" strokeWidth="6" strokeLinecap="round" fill="none" />
          </svg>
          <span className="text-2xl font-black tracking-tight text-white">FLOWEN</span>
        </div>

        {/* Badge */}
        <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 tracking-widest uppercase">
          Beta launching soon
        </span>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            We&rsquo;re almost<br />
            <span className="bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              ready for you
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Flowen is putting the finishing touches on the platform.<br />
            Early access invites will be sent shortly.
          </p>
        </div>

        {/* Countdown / launched */}
        {time.days + time.hours + time.minutes + time.seconds === 0 ? (
          <div className="flex flex-col items-center gap-3">
            <div className="px-6 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xl tracking-tight">
              🎉 We&rsquo;re live!
            </div>
            <p className="text-slate-400 text-sm">Flowen is now available — sign in to get started.</p>
          </div>
        ) : (
          <div className="flex items-start gap-4 sm:gap-6">
            <Digit value={time.days}    label="Days"    />
            <div className="text-slate-700 text-4xl font-black mt-4 select-none">:</div>
            <Digit value={time.hours}   label="Hours"   />
            <div className="text-slate-700 text-4xl font-black mt-4 select-none">:</div>
            <Digit value={time.minutes} label="Minutes" />
            <div className="text-slate-700 text-4xl font-black mt-4 select-none">:</div>
            <Digit value={time.seconds} label="Seconds" />
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="/auth/login"
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-colors text-center"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium text-sm transition-colors text-center"
          >
            Back to homepage
          </Link>
        </div>

        <p className="text-slate-600 text-xs font-mono">
          Already have early access?{' '}
          <Link href="/auth/login" className="text-emerald-500 hover:text-emerald-400 transition-colors">
            Sign in to enter
          </Link>
        </p>
      </div>
    </div>
  );
}
