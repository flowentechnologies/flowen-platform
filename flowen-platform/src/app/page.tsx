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
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
              Flowen
            </span>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 font-bold">
              v2.6 Enterprise AT
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-400 font-mono">
            <Link href="/" className="text-white font-bold hover:text-emerald-400 transition">Home</Link>
            <Link href="/dashboard/practice" className="hover:text-emerald-400 transition">How It Works</Link>
            <Link href="/pricing" className="hover:text-emerald-400 transition">Pricing</Link>
            <Link href="/dashboard/clinician" className="hover:text-emerald-400 transition">Professionals</Link>
            <Link href="/admin" className="hover:text-emerald-400 transition">Governments</Link>
            <Link href="/telemetry" className="hover:text-emerald-400 transition">Telemetry</Link>
            <Link href="/admin/audit" className="hover:text-emerald-400 transition">Security Audit</Link>
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 md:py-16 space-y-16">
        
        {/* Backronym Banner */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
              THE BACKRONYM
            </span>
            <div className="text-slate-300">
              <strong className="text-emerald-400">F</strong>luency & <strong class="text-emerald-400">L</strong>anguage <strong class="text-emerald-400">O</strong>ptimization <strong class="text-sky-400">W</strong>ith <strong class="text-sky-400">E</strong>mpathic <strong class="text-sky-400">N</strong>eurofeedback
            </div>
          </div>
          <span className="text-slate-400 italic">"Every word gets there."</span>
        </div>

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            FOUNDING MEMBER COHORT ACTIVE • #WaitlistHero
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-tight max-w-4xl">
            From block to <span className="text-emerald-400">flow.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl font-normal leading-relaxed">
            AI Speech Coordination for School, Workplace & Daily Life. Private, patient, and available 24/7.
          </p>

          {/* Compliance Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-mono font-semibold text-slate-400">
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">✓ DTAC Aligned</span>
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-sky-400">✓ DCB0129 Clinical Safety</span>
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-purple-400">✓ UK GDPR Secured</span>
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400">✓ WCAG 2.2 AA Target</span>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/waitlist"
              className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition shadow-xl shadow-emerald-500/20 w-full sm:w-auto"
            >
              Join Waitlist / Lock 50% Off →
            </Link>
            <Link
              href="/dashboard/practice"
              className="px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm border border-slate-800 transition w-full sm:w-auto"
            >
              Launch 5-Stage Practice Engine
            </Link>
          </div>
        </div>

        {/* Video Demo Placeholder Widget */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-4">
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 border-b border-slate-800 pb-4">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              PRODUCT DEMO & 3D GUIDE SHOWCASE
            </span>
            <span className="text-emerald-400">VIDEO_ASSET_PLACEHOLDER [1080p MP4]</span>
          </div>
          <div className="relative aspect-video bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-3 overflow-hidden group">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              ▶
            </div>
            <p className="text-xs font-mono text-slate-400">Click to Play Product Overview Video</p>
            <span className="text-[10px] font-mono text-slate-600">ASSET_ID: vid_flowen_demo_2026.mp4</span>
          </div>
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
          </div>
        </div>

        {/* Placeholders for 3D Guide Canvas & Camera Mirror Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="font-bold text-white">3D GUIDE CANVAS PLACEHOLDER</span>
              <span className="text-sky-400">Three.js / Ready Player Me</span>
            </div>
            <div className="h-64 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-2 text-center p-4">
              <div className="w-16 h-16 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 text-2xl font-bold">
                🤖
              </div>
              <p className="text-xs font-mono text-slate-300">3D Animated Viseme Avatar Viewport</p>
              <span className="text-[10px] font-mono text-slate-600">CANVAS_ID: canvas_3d_viseme_guide</span>
            </div>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="font-bold text-white">SIDE-BY-SIDE MIRROR MODE PLACEHOLDER</span>
              <span className="text-purple-400">Webcam Overlay</span>
            </div>
            <div className="h-64 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-2 text-center p-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 text-2xl font-bold">
                📷
              </div>
              <p className="text-xs font-mono text-slate-300">Camera Mouth Tracking Overlay</p>
              <span className="text-[10px] font-mono text-slate-600">CANVAS_ID: webcam_mirror_overlay</span>
            </div>
          </div>
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
            </ul>
          </div>

          <div>
            <div className="text-slate-400 font-bold uppercase mb-3">Partners</div>
            <ul className="space-y-2 text-slate-500">
              <li><Link href="/dashboard/clinician" className="hover:text-slate-300">Professionals</Link></li>
              <li><Link href="/admin" className="hover:text-slate-300">Governments</Link></li>
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
