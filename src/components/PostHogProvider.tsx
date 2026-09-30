'use client';

import posthog from 'posthog-js';
import { queueGa4Event } from '@/lib/analytics/ga4-client';

import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pixelCompleteRegistrationWithId } from '@/lib/pixel';
import { capturePostHog, hasPostHogConsent, identifyPostHog, resetPostHogIdentity, revokePostHog, startPostHog } from '@/lib/posthog-consent';


function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!hasPostHogConsent()) return;
    const url = `${window.location.origin}${pathname}${searchParams.toString() ? `?${searchParams}` : ''}`;
    capturePostHog('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}


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


function fireSignupEvent(eventId: string, userId: string): boolean {
  if (typeof window.gtag !== 'function') return false;
  // Meta CompleteRegistration — consent-gated inside pixel.ts; the event ID
  // is shared with the server-side CAPI send so the two deduplicate into
  // one conversion.
  pixelCompleteRegistrationWithId(eventId, { content_name: 'flowen_signup' });
  // Consented GA4 sign_up — no email, no clinical content.
  queueGa4Event('sign_up', { method: 'email' });
  // Product analytics (not an ad network).
  capturePostHog('user_signed_up', { user_id: userId });
  return true;
}

function fireOnboardingEvent(): void {
  queueGa4Event('onboarding_complete');
}

function checkOneShotEvents(userId?: string): void {
  const signupEventId = readOneShotCookie('flowen_signup_event');
  if (signupEventId && userId) {
    if (hasPostHogConsent()) {
      if (!fireSignupEvent(signupEventId, userId)) return;
      clearOneShotCookie('flowen_signup_event');
    }
  }
  if (readOneShotCookie('flowen_onboarding_event')) {
    if (hasPostHogConsent()) {
      fireOnboardingEvent();
      clearOneShotCookie('flowen_onboarding_event');
    }
  }
}

function AuthIdentityTracker() {
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const ready = () => {
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (active && user && hasPostHogConsent()) checkOneShotEvents(user.id);
      });
    };
    window.addEventListener('flowen:tracking:ready', ready);

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active || !hasPostHogConsent()) return;
      if (user) {
        identifyPostHog(user);
        checkOneShotEvents(user.id);
      } else {
        resetPostHogIdentity();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !hasPostHogConsent()) return;
      if (event === 'SIGNED_OUT') {
        resetPostHogIdentity();
      } else if (event === 'SIGNED_IN' && session?.user) {
        identifyPostHog(session.user);
        checkOneShotEvents(session.user.id);
      }
    });

    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('flowen:tracking:ready', ready); };
  }, []);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const grant = () => setActive(startPostHog());
    const revoke = () => { revokePostHog(); setActive(false); };
    grant(); // Existing persisted 'all' decision on a later visit.
    window.addEventListener('flowen:consent:granted', grant);
    window.addEventListener('flowen:consent:revoked', revoke);
    return () => {
      window.removeEventListener('flowen:consent:granted', grant);
      window.removeEventListener('flowen:consent:revoked', revoke);
    };
  }, []);

  return (
    <PHProvider client={posthog}>
      {active && <AuthIdentityTracker />}
      {active && <Suspense fallback={null}><PageViewTracker /></Suspense>}
      {children}
    </PHProvider>
  );
}
