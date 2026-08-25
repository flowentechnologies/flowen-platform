'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logout } from '@/app/auth/actions';
import posthog from 'posthog-js';

function Section({ title, description, danger, children }: {
  title: string; description?: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 ${danger ? 'border-red-900/40' : 'border-slate-200 dark:border-slate-800'}`}>
      <h2 className={`text-sm font-bold mb-0.5 ${danger ? 'text-red-400' : 'text-slate-900 dark:text-white'}`}>{title}</h2>
      {description && <p className="text-slate-500 text-xs mb-5 leading-relaxed">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [nameLoaded,  setNameLoaded]  = useState(false);
  const [nameSaving,  startNameSave]  = useTransition();
  const [nameMsg,     setNameMsg]     = useState('');

  const [confirmText,  setConfirmText]  = useState('');
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [erasing,      setErasing]      = useState(false);
  const [erasureError, setErasureError] = useState('');

  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [streakEnabled,    setStreakEnabled]    = useState(true);
  const [reminderHour,     setReminderHour]     = useState(9);
  const [notifSaving,      startNotifSave]      = useTransition();
  const [notifMsg,         setNotifMsg]         = useState('');
  const [notifLoaded,      setNotifLoaded]      = useState(false);

  const [dataConsent,      setDataConsent]      = useState(false);
  const [dataConsentLoaded, setDataConsentLoaded] = useState(false);
  const [dataConsentSaving, startDataConsentSave] = useTransition();
  const [dataConsentMsg,   setDataConsentMsg]   = useState('');

  React.useEffect(() => {
    if (nameLoaded && dataConsentLoaded) return;
    createClient().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await createClient()
        .from('profiles')
        .select('display_name, consent_data_collection')
        .eq('id', user.id)
        .single();
      setDisplayName(data?.display_name ?? '');
      setDataConsent(data?.consent_data_collection ?? false);
      setNameLoaded(true);
      setDataConsentLoaded(true);
    });
  }, [nameLoaded, dataConsentLoaded]);

  useEffect(() => {
    if (notifLoaded) return;
    fetch('/api/user/notifications')
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then((json: { email_reminders?: boolean; streak_notifications?: boolean; reminder_hour?: number }) => {
        setRemindersEnabled(json.email_reminders ?? true);
        setStreakEnabled(json.streak_notifications ?? true);
        setReminderHour(json.reminder_hour ?? 9);
      })
      .catch(() => {
        // 404 or error — use defaults (true, true)
      })
      .finally(() => setNotifLoaded(true));
  }, [notifLoaded]);

  const handleSaveName = () => {
    setNameMsg('');
    startNameSave(async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { error } = await sb.from('profiles').update({ display_name: displayName || null }).eq('id', user.id);
      setNameMsg(error ? 'Failed to save.' : 'Saved.');
    });
  };

  const handleSaveNotifications = () => {
    setNotifMsg('');
    startNotifSave(async () => {
      try {
        const res = await fetch('/api/user/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_reminders: remindersEnabled, streak_notifications: streakEnabled, reminder_hour: reminderHour }),
        });
        if (res.ok) {
          posthog.capture('settings_updated', {
            settings_section: 'notifications',
            practice_reminders_enabled: remindersEnabled,
            streak_notifications_enabled: streakEnabled,
          });
        }
        setNotifMsg(res.ok ? 'Saved.' : 'Failed to save.');
      } catch {
        setNotifMsg('Failed to save.');
      }
    });
  };

  const handleDataConsentToggle = (next: boolean) => {
    setDataConsent(next);
    setDataConsentMsg('');
    startDataConsentSave(async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      await sb.from('profiles').update({
        consent_data_collection:         next,
        consent_data_collection_at:      next ? new Date().toISOString() : null,
        consent_data_collection_version: next ? '2026-08-01' : null,
      }).eq('id', user.id);
      // Audit log
      await sb.from('consent_audit_log').insert({
        user_id:          user.id,
        event_type:       next ? 'data_collection_consent_given' : 'data_collection_consent_withdrawn',
        consent_version:  '2026-08-01',
      });
      posthog.capture('settings_updated', { settings_section: 'data_collection', consent: next });
      setDataConsentMsg(next ? 'Thank you — your sessions will now contribute to training.' : 'Preference saved. No further audio will be collected.');
    });
  };

  const handleErasure = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') return;
    setErasing(true);
    setErasureError('');
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }
    const { error } = await sb.rpc('apply_gdpr_erasure', { target_user_id: user.id });
    if (error) {
      setErasureError('Could not process your request. Email hello@flowen.digital with subject [ERASURE REQUEST].');
      setErasing(false);
      return;
    }
    await sb.from('consent_audit_log').insert({
      user_id: user.id, event_type: 'gdpr_consent_withdrawn', consent_version: '2026-07-01',
    });
    posthog.capture('account_erasure_requested');
    await sb.auth.signOut();
    router.push('/?erased=true');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your profile, security, and account data</p>
      </div>

      {/* Profile */}
      <Section title="Profile" description="How your name appears across the platform.">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveName}
              disabled={nameSaving || !nameLoaded}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-sm transition-colors"
            >
              {nameSaving ? 'Saving…' : 'Save'}
            </button>
            {nameMsg && <span className="text-xs text-slate-400">{nameMsg}</span>}
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section title="Security" description="Change your password or update your sign-in method.">
        <button
          onClick={() => router.push('/auth/forgot-password')}
          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white transition-colors"
        >
          Reset password via email
        </button>
      </Section>

      {/* Support */}
      <Section title="Help & Support" description="Get help, report issues, or contact the Flowen team.">
        <button
          onClick={() => router.push('/dashboard/support')}
          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white transition-colors"
        >
          Open Support Centre →
        </button>
      </Section>

      {/* Data Export */}
      <Section title="Data Export" description="Download all your practice session data as JSON under UK GDPR Article 20 (Right to Data Portability).">
        <a
          href="/api/user/export"
          download
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white transition-colors"
        >
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download my data
        </a>
      </Section>

      {/* Email Notifications */}
      <Section title="Email Notifications" description="Control which reminder emails Flowen sends you.">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-900 dark:text-white">Practice reminders</p>
              <p className="text-xs text-slate-500 mt-0.5">Sent when you haven&apos;t practiced in 3+ days</p>
            </div>
            <button
              type="button"
              onClick={() => setRemindersEnabled(v => !v)}
              aria-pressed={remindersEnabled}
              aria-label="Practice reminders"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${remindersEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${remindersEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-900 dark:text-white">Streak milestones</p>
              <p className="text-xs text-slate-500 mt-0.5">Celebrate 3, 7, 14, and 30-day streaks</p>
            </div>
            <button
              type="button"
              onClick={() => setStreakEnabled(v => !v)}
              aria-pressed={streakEnabled}
              aria-label="Streak milestone notifications"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${streakEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${streakEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-900 dark:text-white">Reminder time</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(() => {
                  try {
                    const localHour = new Date(Date.UTC(2000, 0, 1, reminderHour)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    return `${localHour} your local time (${tz}) · stored as ${String(reminderHour).padStart(2,'0')}:00 UTC`;
                  } catch { return `${String(reminderHour).padStart(2,'0')}:00 UTC`; }
                })()}
              </p>
            </div>
            <select
              value={reminderHour}
              onChange={e => setReminderHour(Number(e.target.value))}
              disabled={!notifLoaded}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-40"
            >
              {Array.from({ length: 24 }, (_, h) => {
                const local = new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                return <option key={h} value={h}>{String(h).padStart(2, '0')}:00 UTC ({local} local)</option>;
              })}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveNotifications}
              disabled={notifSaving || !notifLoaded}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-sm transition-colors"
            >
              {notifSaving ? 'Saving…' : 'Save'}
            </button>
            {notifMsg && <span className="text-xs text-slate-400">{notifMsg}</span>}
          </div>
        </div>
      </Section>

      {/* AI Training Data */}
      <Section title="Contribute to AI Training" description="Help improve Flowen's speech recognition for people who stutter. Your practice recordings will be used to fine-tune our ASR model. You can withdraw at any time — this does not affect existing data already contributed.">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm text-slate-900 dark:text-white font-medium">Share my voice recordings</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Audio from your practice sessions will be stored securely and used only to train Flowen&apos;s disfluency-aware ASR model.
                Recordings are never sold or shared externally. See our{' '}
                <a href="/legal" className="underline decoration-slate-600 hover:text-slate-300">Privacy Policy</a> for full details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDataConsentToggle(!dataConsent)}
              disabled={dataConsentSaving || !dataConsentLoaded}
              aria-pressed={dataConsent}
              aria-label="Share voice recordings for AI training"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-40 ${dataConsent ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${dataConsent ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {dataConsentMsg && <p className="text-xs text-emerald-400">{dataConsentMsg}</p>}
        </div>
      </Section>

      {/* Sign out */}
      <Section title="Session" description="Sign out of your account on this device.">
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white transition-colors"
          >
            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd"/>
              <path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z" clipRule="evenodd"/>
            </svg>
            Sign out
          </button>
        </form>
      </Section>

      <div className="flex gap-4 text-[11px] text-slate-600 pt-2">
        {[['Privacy Policy', '/legal'], ['Cookie Policy', '/cookie-policy'], ['Security', '/security']].map(([label, href]) => (
          <a key={href} href={href} className="hover:text-slate-400 transition-colors">{label}</a>
        ))}
      </div>

      {/* Danger zone */}
      <Section title="Delete Account" danger
        description="Permanently delete your account and all data under UK GDPR Article 17. Voice session data, telemetry, and your profile will be anonymised within 30 days. This cannot be undone.">
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-xl bg-red-950 hover:bg-red-900 text-red-400 text-sm border border-red-800/50 transition-colors"
          >
            Request account deletion
          </button>
        ) : (
          <div className="space-y-3">
            {erasureError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{erasureError}</p>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Type <span className="font-mono text-red-400">DELETE MY ACCOUNT</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-red-800/50 text-slate-900 dark:text-white placeholder-slate-600 focus:outline-none focus:border-red-500 text-sm font-mono"
            />
            <div className="flex gap-3">
              <button
                onClick={handleErasure}
                disabled={erasing || confirmText !== 'DELETE MY ACCOUNT'}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-slate-900 dark:text-white text-sm font-semibold transition-colors disabled:opacity-40"
              >
                {erasing ? 'Processing…' : 'Confirm deletion'}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(''); setErasureError(''); }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
