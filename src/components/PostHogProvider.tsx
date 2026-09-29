'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pixelCompleteRegistrationWithId } from '@/lib/pixel';


function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    const url = `${window.location.origin}${pathname}${searchParams.toString() ? `?${searchParams}` : ''}`;
    ph.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

const IDENTIFIED_USER_ID_KEY = 'flowen_posthog_user_id';

// ── One-shot milestone events ────────────────────────────────────────────────
// The server sets these short-lived, JS-readable cookies at the exact
// verified milestone moment (new-account confirmation in /auth/callback,
// persisted onboarding completion in complete-onboarding). This replaces the
// old localStorage + created_at heuristic, which fired a "signup" for any
// returning user on a fresh device or cleared storage.

function readOneShotCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

function clearOneShotCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`;
}

function hasAdsConsent(): boolean {
  return typeof document !== 'undefined' && document.cookie.includes('flowen_cookie_consent=all');
}

function fireSignupEvent(eventId: string, userId: string): void {
  // Meta CompleteRegistration — consent-gated inside pixel.ts; the event ID
  // is shared with the server-side CAPI send so the two deduplicate into
  // one conversion.
  pixelCompleteRegistrationWithId(eventId, { content_name: 'flowen_signup' });
  // Consented GA4 sign_up — no email, no clinical content.
  if (hasAdsConsent() && typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'sign_up', { method: 'email' });
  }
  // Product analytics (not an ad network).
  posthog.capture('user_signed_up', { user_id: userId });
}

function fireOnboardingEvent(): void {
  if (hasAdsConsent() && typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'onboarding_complete');
  }
}

function checkOneShotEvents(userId?: string): void {
  const signupEventId = readOneShotCookie('flowen_signup_event');
  if (signupEventId && userId) {
    clearOneShotCookie('flowen_signup_event');
    fireSignupEvent(signupEventId, userId);
  }
  if (readOneShotCookie('flowen_onboarding_event')) {
    clearOneShotCookie('flowen_onboarding_event');
    fireOnboardingEvent();
  }
}

function AuthIdentityTracker() {
  useEffect(() => {
    const supabase = createClient();

    const resetIdentity = () => {
      if (localStorage.getItem(IDENTIFIED_USER_ID_KEY)) {
        posthog.reset();
        localStorage.removeItem(IDENTIFIED_USER_ID_KEY);
      }
    };

    const identifyUser = (user: { id: string; email?: string | null }) => {
      const identifiedUserId = localStorage.getItem(IDENTIFIED_USER_ID_KEY);
      if (identifiedUserId && identifiedUserId !== user.id) posthog.reset();

      posthog.identify(user.id, user.email ? { email: user.email } : undefined);
      localStorage.setItem(IDENTIFIED_USER_ID_KEY, user.id);
    };

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        identifyUser(user);
        checkOneShotEvents(user.id);
      } else {
        resetIdentity();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        resetIdentity();
      } else if (event === 'SIGNED_IN' && session?.user) {
        identifyUser(session.user);
        checkOneShotEvents(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <AuthIdentityTracker />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
