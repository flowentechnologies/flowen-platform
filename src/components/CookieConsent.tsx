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

  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      setVisible(true);
      return;
    }
    if (existing === 'all') enableSentryReplay();
  }, []);

  const accept = () => {
    writeConsent('all');
    enableSentryReplay();
    setVisible(false);
  };

  const necessary = () => {
    writeConsent('necessary');
    setVisible(false);
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
            We use strictly necessary cookies for authentication and optional analytics cookies (Sentry error replay) to improve reliability.{' '}
            <Link href="/cookie-policy" className="text-emerald-400 hover:underline whitespace-nowrap">
              Cookie Policy
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={necessary}
            className="px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-xs font-semibold hover:border-slate-500 hover:text-white transition-all whitespace-nowrap"
          >
            Necessary only
          </button>
          <button
            onClick={accept}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all whitespace-nowrap shadow-lg shadow-emerald-500/20"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
