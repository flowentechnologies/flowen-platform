'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { pixelCompleteRegistration } from '@/lib/pixel';


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
      if (user) identifyUser(user);
      else resetIdentity();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        resetIdentity();
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Detect new signup: no prior identity on this device AND account
        // created within the last 10 minutes (guards against false fires when
        // an existing user logs in on a fresh device or clears localStorage).
        const isNewSignup =
          !localStorage.getItem(IDENTIFIED_USER_ID_KEY) &&
          !!session.user.created_at &&
          Date.now() - new Date(session.user.created_at).getTime() < 10 * 60 * 1000;

        identifyUser(session.user);

        if (isNewSignup) {
          // Browser-side signup events — complement the server-side Meta CAPI
          // webhook which fires automatically via the DB trigger.
          pixelCompleteRegistration({ content_name: 'flowen_signup' });
          posthog.capture('user_signed_up', {
            email: session.user.email,
            user_id: session.user.id,
          });
        }
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
