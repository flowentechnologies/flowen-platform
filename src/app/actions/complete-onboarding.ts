'use server';

import { adminDb } from '@/lib/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendAdminNewUserAlert } from '@/lib/email';
import { fireEventWorkflows } from '@/lib/workflow-executor';

const ALLOWED_ROLES = new Set(['pwds', 'clinician', 'researcher', 'parent_carer', 'other']);
const ALLOWED_COUNTRIES = new Set(['GB', 'IE', 'OTHER']);


export async function completeOnboarding(opts: {
  displayName: string;
  role: string;
  consentAt: string;
  // KYC fields
  dateOfBirth?: string;          // ISO date string 'YYYY-MM-DD'
  countryOfResidence?: string;   // ISO 3166-1 alpha-2, e.g. 'GB'
  phoneNumber?: string;
  employerName?: string;
  hcpcNumber?: string;
  institutionName?: string;
  marketingConsent?: boolean;
  // Address fields
  addressLine1?: string;
  addressLine2?: string;
  addressCity?: string;
  addressPostcode?: string;      // normalised by Postcodes.io lookup
  addressRegion?: string;        // returned by Postcodes.io
  addressVerifiedAt?: string;    // ISO timestamp — set when Postcodes.io confirmed the postcode
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

  // Validate KYC fields
  if (opts.countryOfResidence && !ALLOWED_COUNTRIES.has(opts.countryOfResidence)) {
    return { error: 'Invalid country selection' };
  }
  if (opts.dateOfBirth) {
    const dob = new Date(opts.dateOfBirth);
    if (isNaN(dob.getTime())) return { error: 'Invalid date of birth' };
    // Must be at least 13 years old; flag under-18 but don't hard-block (parent/carer accounts)
    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears < 13) return { error: 'You must be at least 13 years old to use Flowen' };
  }
  if (opts.phoneNumber && !/^[+\d\s\-().]{7,20}$/.test(opts.phoneNumber)) {
    return { error: 'Invalid phone number format' };
  }
  if (opts.hcpcNumber && !/^[A-Z]{2}\d{6}$/i.test(opts.hcpcNumber.replace(/\s/g, ''))) {
    return { error: 'HCPC numbers follow the format TS999999 — please check and try again' };
  }

  const admin = adminDb();

  const profileUpdate: Record<string, unknown> = {
    display_name:         opts.displayName.trim(),
    role:                 opts.role,
    brand:                'flowen',
    onboarding_complete:  true,
    gdpr_consent_at:      opts.consentAt,
    gdpr_consent_version: '2026-07-01',
    opt_in_telemetry:     true,
  };

  // Persist KYC fields that were provided
  if (opts.dateOfBirth)        profileUpdate.date_of_birth        = opts.dateOfBirth;
  if (opts.countryOfResidence) profileUpdate.country_of_residence = opts.countryOfResidence;
  if (opts.phoneNumber)        profileUpdate.phone_number         = opts.phoneNumber.trim();
  if (opts.employerName)       profileUpdate.employer_name        = opts.employerName.trim();
  if (opts.hcpcNumber)         profileUpdate.hcpc_number          = opts.hcpcNumber.replace(/\s/g, '').toUpperCase();
  if (opts.institutionName)    profileUpdate.institution_name     = opts.institutionName.trim();
  if (opts.marketingConsent !== undefined) {
    profileUpdate.marketing_consent    = opts.marketingConsent;
    profileUpdate.marketing_consent_at = opts.marketingConsent ? opts.consentAt : null;
  }

  // Address — only store if at least line 1 is provided
  if (opts.addressLine1?.trim()) {
    profileUpdate.address_line1    = opts.addressLine1.trim();
    profileUpdate.address_line2    = opts.addressLine2?.trim() || null;
    profileUpdate.address_city     = opts.addressCity?.trim() || null;
    profileUpdate.address_postcode = opts.addressPostcode?.trim().toUpperCase() || null;
    profileUpdate.address_region   = opts.addressRegion?.trim() || null;
    if (opts.addressVerifiedAt) {
      profileUpdate.address_verified_at = opts.addressVerifiedAt;
    }
  }

  const { error } = await admin
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id);

  if (error) return { error: 'Could not save your profile. Please try again.' };

  await admin.from('consent_audit_log').insert({
    user_id:         user.id,
    event_type:      'gdpr_consent_granted',
    consent_version: '2026-07-01',
    ip_address:      null,
  });

  void Promise.all([
    // Fire all active user_event workflows registered for onboarding_complete
    // (handles welcome email + deferred check-in/milestone steps)
    fireEventWorkflows('onboarding_complete', {
      userId:      user.id,
      email:       user.email ?? '',
      displayName: opts.displayName.trim(),
      triggeredBy: 'onboarding',
    }),
    sendAdminNewUserAlert(user.email ?? '', opts.displayName.trim(), opts.role),
  ]);

  return {};
}
