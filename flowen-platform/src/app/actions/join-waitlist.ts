'use server';

import { createClient } from '@supabase/supabase-js';
import { sendWaitlistConfirmation, sendAdminWaitlistAlert } from '@/lib/email';

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

  const normalised = email.toLowerCase().trim();

  try {
    const { error } = await adminClient()
      .from('waitlist_signups')
      .insert({ email: normalised, source: 'waitlist_page' });

    if (error) {
      if (error.code === '23505') {
        // Unique violation — already registered; don't leak that fact but skip emails.
        return { success: true, message: 'Application received!' };
      }
      console.error('[join-waitlist] insert error:', error.message);
      return { success: false, message: 'Unable to register right now. Please try again.' };
    }

    // Fire-and-forget — email failures must not block the user response.
    void Promise.all([
      sendWaitlistConfirmation(normalised),
      sendAdminWaitlistAlert({ email: normalised }),
    ]);

    return { success: true, message: 'Application received!' };
  } catch (err) {
    console.error('[join-waitlist] unexpected error:', err);
    return { success: false, message: 'Unable to register right now. Please try again.' };
  }
}
