"use client";

import React, { useState } from "react";
import { login, signup } from "../actions";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen bg-[#06080F] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-[#0A0D14] border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-black text-black text-2xl mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            F
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isSignUp ? "Create Your Flowen Account" : "Access Flowen Portal"}
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Sub-80ms Speech Coordination & Telemetry Engine
          </p>
        </div>

        <form action={isSignUp ? signup : login} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="howard@example.com"
              className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Platform Brand
              </label>
              <select
                name="brand"
                className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500 text-sm"
              >
                <option value="flowen">Flowen (Flagship Clinical)</option>
                <option value="vocali">Vocali (Lightweight Global)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 mt-4"
          >
            {isSignUp ? "Register Account" : "Sign In to Application"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Need an account or Access to Work license? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
