'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: { maskAllInputs: false, maskInputOptions: { password: true } },
    autocapture: true,
    opt_out_capturing_by_default: false,
  });
}

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
        identifyUser(session.user);
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
