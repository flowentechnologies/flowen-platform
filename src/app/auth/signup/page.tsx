'use client';

import React, { useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MarketingNavbar from '@/components/MarketingNavbar';
import { createClient } from '@/lib/supabase/client';
import { signup } from '../actions';

function SignupForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  // Preserve ?next= so OAuth callback can return the user to the right page
  const nextParam = (() => {
    const raw = searchParams.get('next') ?? '';
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
  })();

  const [isPending, startTransition] = useTransition();
  const [pwError, setPwError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const supabase = createClient();
    const callbackUrl = nextParam
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`
      : `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    });
    // Page redirects — no need to reset loading state
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get('password') !== fd.get('confirm_password')) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwError(null);
    startTransition(() => signup(fd));
  };

  return (
    <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <h1 className="text-xl font-bold text-white mb-1 text-center">Create your account</h1>
      <p className="text-slate-500 text-xs text-center mb-2">Join Flowen and start your speech fluency journey</p>
      <div className="flex items-center justify-center gap-1.5 mb-6">
        <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
        </svg>
        <span className="text-emerald-400 text-xs font-semibold">3 free sessions included — no card required</span>
      </div>

      {urlError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          {decodeURIComponent(urlError)}
        </div>
      )}
      {pwError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          {pwError}
        </div>
      )}

      {/* Google OAuth */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mb-4"
      >
        {googleLoading ? (
          <svg className="w-4 h-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-slate-800" />
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
            className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Confirm Password
          </label>
          <input
            name="confirm_password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat your password"
            className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
          />
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          By creating an account you agree to our{' '}
          <Link href="/legal#terms-of-service" className="text-emerald-400 hover:underline" target="_blank">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/legal#privacy-policy" className="text-emerald-400 hover:underline" target="_blank">
            Privacy Policy
          </Link>
          .
        </p>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
        >
          {isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500 mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#06080F] flex flex-col">
      <MarketingNavbar />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={
          <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-8 shadow-2xl animate-pulse">
            <div className="h-6 bg-slate-800 rounded w-40 mx-auto mb-2" />
            <div className="h-4 bg-slate-800 rounded w-48 mx-auto mb-6" />
            <div className="h-12 bg-slate-800 rounded-xl mb-4" />
            <div className="h-12 bg-slate-800 rounded-xl mb-4" />
            <div className="h-12 bg-slate-800 rounded-xl mb-4" />
            <div className="h-12 bg-slate-800 rounded-xl" />
          </div>
        }>
          <SignupForm />
        </Suspense>
      </div>
      </div>
    </div>
  );
}
