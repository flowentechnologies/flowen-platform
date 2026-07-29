'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logout } from '@/app/auth/actions';

export default function SettingsPage() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleErasure = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') return;
    setDeleting(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    const { error } = await supabase.rpc('apply_gdpr_erasure', { target_user_id: user.id });

    if (error) {
      setError('Could not process your request. Please email flowenspeech@outlook.com with subject [ERASURE REQUEST].');
      setDeleting(false);
      return;
    }

    await supabase.from('consent_audit_log').insert({
      user_id:         user.id,
      event_type:      'gdpr_consent_withdrawn',
      consent_version: '2026-07-01',
    });

    await supabase.auth.signOut();
    router.push('/?erased=true');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Account Settings</h1>
      <p className="text-slate-400 text-sm mb-10">Manage your Flowen account and data.</p>

      {/* Password change */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-white mb-1">Password</h2>
        <p className="text-slate-400 text-xs mb-4">Change your sign-in password.</p>
        <button
          onClick={() => router.push('/auth/forgot-password')}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-white border border-slate-700 transition-colors"
        >
          Reset password via email
        </button>
      </section>

      {/* Sign out */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="text-base font-semibold text-white mb-1">Sign out</h2>
        <p className="text-slate-400 text-xs mb-4">Sign out of your account on this device.</p>
        <form action={logout}>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-white border border-slate-700 transition-colors"
          >
            Sign out
          </button>
        </form>
      </section>

      {/* Right to erasure — UK GDPR Article 17 */}
      <section className="bg-slate-900 border border-red-900/40 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-red-400 mb-1">Delete account</h2>
        <p className="text-slate-400 text-xs mb-1 leading-relaxed">
          Permanently delete your account and all associated data under UK GDPR Article 17 (Right to Erasure).
          Your voice session data, telemetry, and profile will be anonymised and removed within 30 days.
        </p>
        <p className="text-slate-500 text-xs mb-4">This action cannot be undone.</p>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-xl bg-red-950 hover:bg-red-900 text-red-400 text-sm border border-red-800/50 transition-colors"
          >
            Request account deletion
          </button>
        ) : (
          <div className="space-y-3">
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </p>
            )}
            <p className="text-xs text-slate-300">
              Type <span className="font-mono text-red-400">DELETE MY ACCOUNT</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-red-800/50 text-white placeholder-slate-600 focus:outline-none focus:border-red-500 text-sm font-mono"
            />
            <div className="flex gap-3">
              <button
                onClick={handleErasure}
                disabled={deleting || confirmText !== 'DELETE MY ACCOUNT'}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? 'Processing…' : 'Confirm deletion'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(''); setError(null); }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
