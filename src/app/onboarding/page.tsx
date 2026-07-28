'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const ROLES = [
  { value: 'pwds',          label: 'Person who stutters (PWS)' },
  { value: 'clinician',     label: 'Speech & Language Pathologist' },
  { value: 'researcher',    label: 'Clinical Researcher' },
  { value: 'parent_carer',  label: 'Parent / Carer' },
  { value: 'other',         label: 'Other' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [role,        setRole]        = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('Please enter your name.'); return; }
    if (!role)               { setError('Please select your role.'); return; }
    setError(null);

    startTransition(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({
          display_name:       displayName.trim(),
          brand:              role,
          onboarding_complete: true,
        })
        .eq('id', user.id);

      if (dbErr) {
        setError('Could not save your profile. Please try again.');
        return;
      }

      // Set a cookie so proxy skips the onboarding check on subsequent visits.
      document.cookie = 'flowen_ob=1; path=/; max-age=31536000; SameSite=Lax';
      router.push('/dashboard');
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            WELCOME TO FLOWEN
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-4">
            Let&apos;s set up your profile
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            This takes 30 seconds and personalises your therapy experience.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6"
        >
          {/* Name */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
              Your Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alexander"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-3">
              I am a…
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    role === r.value
                      ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPending ? 'Saving…' : 'Enter the Platform'}
          </button>
        </form>
      </div>
    </div>
  );
}
