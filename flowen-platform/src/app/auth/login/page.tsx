'use client';

import React, { useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FlowenLogo } from '@/components/FlowenLogo';
import { createClient } from '@/lib/supabase/client';
import { login } from '../actions';

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const urlMessage = searchParams.get('message');

  const prefillEmail = searchParams.get('email') ?? '';
  const isInvited = searchParams.get('invited') === '1';
  const [tab, setTab] = useState<'password' | 'magic'>(prefillEmail ? 'magic' : 'password');
  const [email, setEmail] = useState(prefillEmail);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [magicLoading, setMagicLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handlePasswordLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => login(fd));
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (magicLoading) return;
    setMagicLoading(true);
    setMagicError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMagicLoading(false);
    if (error) setMagicError(error.message);
    else setMagicSent(true);
  };

  return (
    <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <h1 className="text-xl font-bold text-white mb-1 text-center">Sign in</h1>
      <p className="text-slate-500 text-xs text-center mb-6">Access your Flowen account</p>

      {isInvited && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          Your invitation was accepted. We&apos;ve prefilled your email — click &ldquo;Send magic link&rdquo; to sign in instantly.
        </div>
      )}
      {urlError && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
          {decodeURIComponent(urlError)}
        </div>
      )}
      {urlMessage === 'check_email' && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          Account created — check your email to confirm, then sign in below.
        </div>
      )}
      {urlMessage === 'password_updated' && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
          Password updated successfully. Sign in below.
        </div>
      )}

      <div className="flex rounded-xl bg-slate-900 p-1 mb-6">
        <button
          onClick={() => setTab('password')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'password' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          Password
        </button>
        <button
          onClick={() => setTab('magic')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'magic' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          Magic Link
        </button>
      </div>

      {tab === 'password' ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="name@example.com"
              className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300">
                Forgot password?
              </Link>
            </div>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          >
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          {magicSent ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 text-center">
              Magic link sent — check your inbox and click the link to sign in.
            </div>
          ) : (
            <>
              {magicError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                  {magicError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={magicLoading}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
              >
                {magicLoading ? 'Sending…' : 'Send Magic Link'}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#06080F] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <FlowenLogo />
        </div>
        <Suspense fallback={
          <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-8 shadow-2xl animate-pulse">
            <div className="h-6 bg-slate-800 rounded w-24 mx-auto mb-2" />
            <div className="h-4 bg-slate-800 rounded w-40 mx-auto mb-6" />
            <div className="h-10 bg-slate-800 rounded-xl mb-4" />
            <div className="h-12 bg-slate-800 rounded-xl mb-4" />
            <div className="h-12 bg-slate-800 rounded-xl mb-4" />
            <div className="h-12 bg-slate-800 rounded-xl" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
