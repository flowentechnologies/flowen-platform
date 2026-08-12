'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import MarketingNavbar from '@/components/MarketingNavbar';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) setError(error.message);
    else router.push('/auth/login?message=password_updated');
  };

  return (
    <div className="min-h-screen bg-[#06080F] flex flex-col">
      <MarketingNavbar />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-1 text-center">Set new password</h1>
          <p className="text-slate-500 text-xs text-center mb-6">Choose a strong password for your account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-4 py-3 rounded-xl bg-[#121624] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
