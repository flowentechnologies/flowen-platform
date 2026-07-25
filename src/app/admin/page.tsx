'use client';
import React from 'react';
import MainNavbar from '@/components/MainNavbar';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              EXECUTIVE CONTROL HUB
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mt-1">Admin Operations</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-xs font-mono text-slate-400 uppercase block mb-1">Active Subscribers</span>
            <span className="text-3xl font-black text-white">1,482</span>
            <span className="text-xs text-emerald-400 block mt-2">+12% this week</span>
          </div>
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-xs font-mono text-slate-400 uppercase block mb-1">Founding Member Slots</span>
            <span className="text-3xl font-black text-emerald-400">412 / 500</span>
            <span className="text-xs text-slate-500 block mt-2">82.4% allocated</span>
          </div>
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-xs font-mono text-slate-400 uppercase block mb-1">API Latency Avg</span>
            <span className="text-3xl font-black text-sky-400">38 ms</span>
            <span className="text-xs text-slate-500 block mt-2">iad1 Edge</span>
          </div>
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-xs font-mono text-slate-400 uppercase block mb-1">System Status</span>
            <span className="text-3xl font-black text-emerald-400">OPERATIONAL</span>
            <span className="text-xs text-slate-500 block mt-2">99.98% uptime</span>
          </div>
        </div>
      </main>
    </div>
  );
}
