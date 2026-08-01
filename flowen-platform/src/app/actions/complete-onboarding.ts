'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendWelcomeEmail, sendAdminNewUserAlert } from '@/lib/email';

const ALLOWED_ROLES = new Set(['pwds', 'clinician', 'researcher', 'parent_carer', 'other']);

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function completeOnboarding(opts: {
  displayName: string;
  role: string;
  consentAt: string;
}): Promise<{ error?: string }> {
  // Derive identity from session cookie — never trust client-supplied user IDs
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  if (!ALLOWED_ROLES.has(opts.role)) return { error: 'Invalid role' };
  if (!opts.displayName.trim() || opts.displayName.length > 100) return { error: 'Invalid display name' };

  const admin = adminClient();

  const { error } = await admin
    .from('profiles')
    .update({
      display_name:         opts.displayName.trim(),
      role:                 opts.role,
      brand:                'flowen',
      onboarding_complete:  true,
      gdpr_consent_at:      opts.consentAt,
      gdpr_consent_version: '2026-07-01',
      opt_in_telemetry:     true,
    })
    .eq('id', user.id);

  if (error) return { error: 'Could not save your profile. Please try again.' };

  await admin.from('consent_audit_log').insert({
    user_id:         user.id,
    event_type:      'gdpr_consent_granted',
    consent_version: '2026-07-01',
    ip_address:      null,
  });

  void Promise.all([
    sendWelcomeEmail(user.email ?? '', opts.displayName.trim()),
    sendAdminNewUserAlert(user.email ?? '', opts.displayName.trim(), opts.role),
  ]);

  return {};
}
