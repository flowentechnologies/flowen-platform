'use server';

import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail, sendAdminNewUserAlert } from '@/lib/email';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function completeOnboarding(opts: {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  consentAt: string;
}): Promise<{ error?: string }> {
  const admin = adminClient();

  const { error } = await admin
    .from('profiles')
    .update({
      display_name:         opts.displayName,
      role:                 opts.role,
      brand:                'flowen',
      onboarding_complete:  true,
      gdpr_consent_at:      opts.consentAt,
      gdpr_consent_version: '2026-07-01',
      opt_in_telemetry:     true,
    })
    .eq('id', opts.userId);

  if (error) return { error: 'Could not save your profile. Please try again.' };

  await admin.from('consent_audit_log').insert({
    user_id:         opts.userId,
    event_type:      'gdpr_consent_granted',
    consent_version: '2026-07-01',
    ip_address:      null,
  });

  void Promise.all([
    sendWelcomeEmail(opts.email, opts.displayName),
    sendAdminNewUserAlert(opts.email, opts.displayName, opts.role),
  ]);

  return {};
}
