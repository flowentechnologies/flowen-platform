'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [simulating, setSimulating] = useState(false);
  const [latency, setLatency] = useState(112);

  const triggerSimulation = () => {
    setSimulating(true);
    setLatency(Math.floor(Math.random() * 30) + 95);
    setTimeout(() => setSimulating(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              Flowen
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              v2.6 AT Speech Coordination
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <Link href="/" className="text-white font-bold hover:text-emerald-400 transition">Home</Link>
            <Link href="/dashboard/practice" className="hover:text-emerald-400 transition">How It Works</Link>
            <Link href="/pricing" className="hover:text-emerald-400 transition">Pricing</Link>
            <Link href="/dashboard/clinician" className="hover:text-emerald-400 transition">Professionals</Link>
            <Link href="/admin" className="hover:text-emerald-400 transition">Governments</Link>
            <Link href="/telemetry" className="hover:text-emerald-400 transition">Affiliates</Link>
            <Link href="/legal" className="hover:text-emerald-400 transition">Legal & Compliance</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition"
            >
              Dashboard →
            </Link>
            <Link
              href="/waitlist"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 md:py-20 space-y-20">
        {/* Banner Badge */}
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            FOUNDING MEMBER COHORT ACTIVE
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-tight max-w-4xl">
            Every word gets there.
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl font-normal leading-relaxed">
            AI Speech Coordination for School, Workplace & Daily Life
          </p>

          {/* Compliance Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-mono font-semibold text-slate-400">
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">DTAC Aligned</span>
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-sky-400">DCB0129 Clinical Safety</span>
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-purple-400">UK GDPR Secured</span>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/waitlist"
              className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition shadow-xl shadow-emerald-500/20 w-full sm:w-auto"
            >
              Join Waitlist / Lock 50% Off →
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm border border-slate-800 transition w-full sm:w-auto"
            >
              Open Interactive Dashboard
            </Link>
          </div>
        </div>

        {/* Section Divider */}
        <div className="border-t border-slate-900 pt-16 text-center space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-400 tracking-widest uppercase">
            SUB-150MS VOCAL RETRAINING ENGINE
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">From block to flow.</h2>
        </div>

        {/* Interactive Telemetry Simulator */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <span className="text-xs font-mono font-bold text-slate-400 uppercase">INTERACTIVE ENGINE DEMOS</span>
              <h3 className="text-xl font-bold text-white mt-1">Disfluent Voice Telemetry Simulator</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Standard speech engines timeout during vocal blocks. Flowen's real-time engine operates with sub-150ms feedback latency to prevent speech freeze.
              </p>
            </div>
            <button
              onClick={triggerSimulation}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold border border-slate-700 transition"
            >
              {simulating ? 'Analyzing Acoustic Stream...' : 'Simulate Speech Block'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <span className="text-slate-500 uppercase block">Detected Latency:</span>
              <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                <span>{latency} ms</span>
                <span className="text-[10px] font-normal px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">SUB-150MS TARGET</span>
              </div>
            </div>

            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <span className="text-slate-500 uppercase block">Standard ASR Status:</span>
              <div className="text-2xl font-bold text-amber-400">
                {simulating ? 'Timeout Blocked (3200ms)' : 'Listening...'}
              </div>
            </div>
          </div>

          {/* Real-time Spectrum Feed Graphic */}
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>REAL-TIME SPECTRUM FEED</span>
              <span className="text-emerald-400 font-bold">FLUENT PATTERN</span>
            </div>
            <div className="h-20 flex items-end justify-between gap-1">
              {[30, 45, 60, 25, 90, 80, 40, 70, 85, 95, 30, 50, 65, 80, 45, 90, 75, 35, 60, 85, 40, 95, 70, 55].map((h, i) => (
                <div
                  key={i}
                  className={`w-full rounded-full transition-all duration-300 ${simulating ? 'bg-amber-500' : 'bg-emerald-400'}`}
                  style={{ height: `${h}%` }}
                ></div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-900">
              <span>Easy Onset</span>
              <span>150ms Threshold</span>
              <span>3200ms Timeout</span>
            </div>
          </div>
        </div>

        {/* Demo Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/telemetry" className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition text-center">
            <span className="block text-xs font-mono text-slate-400 uppercase">ASR Latency</span>
            <span className="text-sm font-bold text-white mt-1 block">Telemetry Stream</span>
          </Link>
          <Link href="/dashboard/practice" className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition text-center">
            <span className="block text-xs font-mono text-slate-400 uppercase">Practice Ladder</span>
            <span className="text-sm font-bold text-white mt-1 block">5-Stage Engine</span>
          </Link>
          <Link href="/admin" className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition text-center">
            <span className="block text-xs font-mono text-slate-400 uppercase">ARR & TAM</span>
            <span className="text-sm font-bold text-white mt-1 block">Platform Economics</span>
          </Link>
          <Link href="/admin/audit" className="p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-slate-700 transition text-center">
            <span className="block text-xs font-mono text-slate-400 uppercase">Compliance</span>
            <span className="text-sm font-bold text-white mt-1 block">Security Audit</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs font-mono">
          <div className="space-y-3">
            <div className="text-sm font-bold text-white">Flowen Technologies Ltd</div>
            <p className="text-slate-500 leading-relaxed">
              Retraining the brain to speak freely. Built by someone who stammers, with clinical speech-language pathologists, for the world.
            </p>
          </div>

          <div>
            <div className="text-slate-400 font-bold uppercase mb-3">Product</div>
            <ul className="space-y-2 text-slate-500">
              <li><Link href="/" className="hover:text-slate-300">Home</Link></li>
              <li><Link href="/dashboard/practice" className="hover:text-slate-300">How It Works</Link></li>
              <li><Link href="/pricing" className="hover:text-slate-300">Pricing</Link></li>
              <li><Link href="/waitlist" className="hover:text-slate-300">Affiliates</Link></li>
            </ul>
          </div>

          <div>
            <div className="text-slate-400 font-bold uppercase mb-3">Partners</div>
            <ul className="space-y-2 text-slate-500">
              <li><Link href="/dashboard/clinician" className="hover:text-slate-300">Professionals</Link></li>
              <li><Link href="/admin" className="hover:text-slate-300">Governments</Link></li>
              <li><a href="mailto:flowenspeech@outlook.com" className="hover:text-slate-300">flowenspeech@outlook.com</a></li>
            </ul>
          </div>

          <div>
            <div className="text-slate-400 font-bold uppercase mb-3">Compliance</div>
            <ul className="space-y-2 text-slate-500">
              <li><Link href="/legal" className="hover:text-slate-300">Legal Hub</Link></li>
              <li><Link href="/admin/audit" className="hover:text-slate-300">Security Audit Matrix</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t border-slate-900/80 flex flex-col md:flex-row justify-between items-center text-slate-600 text-[11px] font-mono">
          <span>© 2026 Flowen Technologies Ltd. London, UK. All rights reserved.</span>
          <a href="#" className="hover:text-slate-400 mt-2 md:mt-0">Back to Top ↑</a>
        </div>
      </footer>
    </div>
  );
}
