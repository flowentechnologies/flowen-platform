'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const CONSENT_COOKIE = 'flowen_cookie_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

type ConsentLevel = 'all' | 'necessary';

function readConsent(): ConsentLevel | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)flowen_cookie_consent=([^;]+)/);
  const val = match?.[1];
  return val === 'all' || val === 'necessary' ? val : null;
}

function writeConsent(level: ConsentLevel) {
  document.cookie = `${CONSENT_COOKIE}=${level}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

/**
 * Server-verifiable record of the decision — every ad-network endpoint
 * re-checks consent_records via src/lib/consent.ts, so this POST is the
 * authoritative half of the choice; the cookie above is only the fast path
 * for script injection in this browser.
 */
async function recordConsent(decision: ConsentLevel): Promise<boolean> {
  try {
    const response = await fetch('/api/consent', {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify({ decision }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function enableSentryReplay() {
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.addIntegration(
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })
    );
  } catch {
    // Sentry not available — not a fatal error
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      setVisible(true);
      return;
    }
    if (existing === 'all') enableSentryReplay();
  }, []);

  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener('flowen:consent:manage', show);
    return () => window.removeEventListener('flowen:consent:manage', show);
  }, []);

  const accept = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    // Wait for the server consent row before any client tracking can start.
    if (!await recordConsent('all')) {
      setError('Could not save your choice. Please try again.');
      setSaving(false);
      return;
    }
    writeConsent('all');
    enableSentryReplay();
    window.dispatchEvent(new Event('flowen:consent:granted'));
    setVisible(false);
    setSaving(false);
  };

  const necessary = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    const wasAll = readConsent() === 'all';
    // Stop client capture synchronously, even if server persistence is slow.
    writeConsent('necessary');
    window.dispatchEvent(new Event('flowen:consent:revoked'));
    const saved = await recordConsent('necessary');
    if (!saved) {
      setError('Could not save your choice on the server. Please retry Necessary only.');
      setSaving(false);
      return;
    }
    setVisible(false);
    setSaving(false);
    // Consent-gated injected scripts and Sentry Replay cannot be reliably
    // unloaded; a reload after the server acknowledges revocation removes them.
    if (wasAll) window.location.reload();
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div className="max-w-3xl mx-auto bg-[#0A0D14] border border-slate-700 rounded-2xl shadow-2xl shadow-black/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white mb-1">This site uses cookies</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            We use strictly necessary cookies for authentication. With your consent we also use
            analytics and advertising cookies (Google, Meta, Snapchat, LinkedIn) and Sentry error
            replay to measure and improve the service.{' '}
            <Link href="/cookie-policy" className="text-emerald-400 underline whitespace-nowrap">
              Cookie Policy
            </Link>
          </p>
        </div>
        {error && <p role="alert" className="text-red-300 text-xs">{error}</p>}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={necessary}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-xs font-semibold hover:border-slate-500 hover:text-white transition-all whitespace-nowrap"
          >
            Necessary only
          </button>
          <button
            onClick={accept}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all whitespace-nowrap shadow-lg shadow-emerald-500/20"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
