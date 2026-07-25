'use client';
import React, { useState } from 'react';
import MainNavbar from '@/components/MainNavbar';

export default function WaitlistPage() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <MainNavbar />
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-12 flex flex-col justify-center">
        <div className="text-center space-y-4 mb-8">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            EARLY ACCESS PROGRAM
          </span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Join the Flowen Waitlist</h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Secure priority allocation for our neural speech fluency engine.
          </p>
        </div>

        {submitted ? (
          <div className="bg-slate-900 border border-emerald-500/50 p-8 rounded-3xl text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
            <h3 className="text-xl font-bold text-white">Application Received!</h3>
            <p className="text-xs text-slate-400">Updates will be delivered to <span className="text-emerald-400 font-mono">{email}</span>.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alexander@flowen.digital"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button type="submit" className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20">
              Request Priority Access
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
