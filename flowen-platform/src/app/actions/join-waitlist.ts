'use server';

import { createClient } from '@supabase/supabase-js';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function joinWaitlist(
  email: string,
): Promise<{ success: boolean; message: string }> {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return { success: false, message: 'A valid email address is required.' };
  }

  try {
    const { error } = await adminClient()
      .from('waitlist_signups')
      .insert({ email: email.toLowerCase().trim(), source: 'waitlist_page' });

    if (error) {
      if (error.code === '23505') {
        // Unique violation — treat as success so we don't leak registration status.
        return { success: true, message: 'Application received!' };
      }
      console.error('[join-waitlist] insert error:', error.message);
      return { success: false, message: 'Unable to register right now. Please try again.' };
    }

    return { success: true, message: 'Application received!' };
  } catch (err) {
    console.error('[join-waitlist] unexpected error:', err);
    return { success: false, message: 'Unable to register right now. Please try again.' };
  }
}
