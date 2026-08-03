'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

const POSTHOG_KEY  = process.env.NEXT_PUBLIC_POSTHOG_KEY  ?? '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

// ── Init (client-side only, once) ─────────────────────────────────────────────

if (typeof window !== 'undefined' && POSTHOG_KEY && !posthog.__loaded) {
  posthog.init(POSTHOG_KEY, {
    api_host:                    POSTHOG_HOST,
    ui_host:                     'https://eu.posthog.com',
    capture_pageview:            false, // we fire manually below for SPA accuracy
    capture_pageleave:           true,
    capture_exceptions:          true,  // required for self-driving error detection
    enable_recording_console_log: true,
    session_recording: {
      maskAllInputs:    true,   // GDPR — mask form fields
      maskTextSelector: '[data-ph-mask]', // opt-in masking for sensitive content
    },
    persistence:  'localStorage+cookie',
    autocapture:  true,
    loaded: (ph) => {
      // Respect cookie consent: opt out by default, opt in after accept
      const consent = document.cookie.includes('flowen_cookie_consent=all');
      if (!consent) ph.opt_out_capturing();

      // Re-enable when consent is granted (fired by CookieConsent component)
      window.addEventListener('flowen:consent:granted', () => ph.opt_in_capturing());
    },
  });
}

// ── SPA page-view tracker ─────────────────────────────────────────────────────

function PageViewTracker() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const ph           = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const url = `${window.location.origin}${pathname}${searchParams.toString() ? `?${searchParams}` : ''}`;
    ph.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
