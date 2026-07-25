'use client';
import React from 'react';
import MainNavbar from '@/components/MainNavbar';

export default function TelemetryPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="pb-6 border-b border-slate-800">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            REAL-TIME TELEMETRY
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">Acoustic Telemetry Log</h1>
        </div>

        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl font-mono text-xs space-y-3">
          <div className="flex justify-between border-b border-slate-800 pb-2 text-slate-400">
            <span>TIMESTAMP</span>
            <span>EVENT_TYPE</span>
            <span>LATENCY</span>
            <span>STATUS</span>
          </div>
          <div className="flex justify-between text-slate-200">
            <span>14:20:01.002</span>
            <span>AUDIO_BUFFER_SYNC</span>
            <span className="text-emerald-400">12 ms</span>
            <span className="text-emerald-400">OK</span>
          </div>
          <div className="flex justify-between text-slate-200">
            <span>14:20:02.145</span>
            <span>FEATURE_EXTRACTION</span>
            <span className="text-emerald-400">18 ms</span>
            <span className="text-emerald-400">OK</span>
          </div>
        </div>
      </main>
    </div>
  );
}
