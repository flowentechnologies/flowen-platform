import type { NextResponse } from 'next/server';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { bridgeAttribution } from '@/lib/attribution';
import { recordMilestone } from '@/lib/analytics/milestones';
import { adminDb } from '@/lib/supabase/admin';
import { SESSION_STARTED_COOKIE, sessionStartedCookieOptions } from '@/lib/auth/session-policy';

const VS_COOKIE = '__vs';

interface RequestCookies {
  get(name: string): { value: string } | undefined;
}

/**
 * Everything that must happen once a non-recovery session exists, shared by
 * the PKCE callback (magic link, OAuth, email confirmation) and the email
 * code route so both sign-in paths behave identically.
 *
 * Writes the session-start and one-shot signup cookies onto `response` and
 * returns the path the user should land on.
 */
export async function finalizeSignIn(opts: {
  cookieStore: RequestCookies;
  response: NextResponse;
  supabase: SupabaseClient;
  session: Session;
  next: string;
}): Promise<string> {
  const { cookieStore, response, supabase, session, next } = opts;

  // Authoritative signup milestone (2026-09-29). recordMilestone inserts
  // once per user and returns the new row's id only on first insert, so
  // the signup conversion fires exactly once - repeated callbacks,
  // OAuth re-links and magic-link re-logins all no-op. The 7-day
  // created_at window covers email confirmations that arrive days after
  // the signup request while excluding long-existing accounts from a
  // one-time backfill fire when this ships.
  const accountAgeMs = Date.now() - new Date(session.user.created_at).getTime();
  let signupEventId: string | null = null;
  if (accountAgeMs >= 0 && accountAgeMs < 7 * 24 * 60 * 60 * 1000) {
    const milestone = await recordMilestone(session.user.id, 'signup', session.user.id);
    signupEventId = milestone.id;
  }

  const [profileRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_admin, onboarding_complete')
      .eq('id', session.user.id)
      .single(),
    // Mark visitor session as converted (existing analytics system).
    (async () => {
      const vsId = cookieStore.get(VS_COOKIE)?.value;
      if (vsId) {
        await adminDb()
          .from('visitor_sessions')
          .update({ converted: true, user_id: session.user.id })
          .eq('id', vsId);
      }
    })(),
    // Bridge marketing attribution - links the flowen_anon_id cookie to
    // the newly authenticated user, triggering the Meta CAPI DB webhook.
    // Only for a verified NEW signup (milestone inserted by this
    // request); a returning user must never fire a signup conversion.
    signupEventId
      ? bridgeAttribution(
          cookieStore.get('flowen_anon_id')?.value,
          session.user.id,
          'signup',
          signupEventId,
        )
      : Promise.resolve(),
  ]);

  const profile = profileRes.data;
  let redirectTo: string;
  if (profile?.is_admin) {
    // Admins always land on admin - don't honour next for security
    redirectTo = '/admin';
  } else if (!profile?.onboarding_complete) {
    // New / incomplete user: must complete onboarding first.
    // Thread `next` through so the final step can redirect there afterwards.
    redirectTo = next !== '/dashboard'
      ? `/onboarding?next=${encodeURIComponent(next)}`
      : '/onboarding';
  } else {
    // Returning user: honour the `next` param (already validated as relative).
    redirectTo = next;
  }
  // Marks the start of the absolute session lifetime - see login() in
  // auth/actions.ts for why this is set independently at every place a
  // session can begin (password login, magic link, code, and OAuth).
  response.cookies.set(SESSION_STARTED_COOKIE, String(Date.now()), sessionStartedCookieOptions());

  if (signupEventId) {
    // One-shot browser flag: PostHogProvider reads this, fires the
    // consented GA4 sign_up + Meta CompleteRegistration with this exact
    // event ID (shared with the server CAPI send for dedup), then
    // clears it. Not httpOnly - the browser must read it; 24-hour TTL.
    response.cookies.set('flowen_signup_event', signupEventId, {
      path: '/',
      maxAge: 60 * 60 * 24,
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return redirectTo;
}
