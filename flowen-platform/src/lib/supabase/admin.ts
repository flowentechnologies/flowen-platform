// ── Supabase Admin Client (service-role) ─────────────────────────────────────
// Single module-level singleton. On Vercel Fluid Compute, warm function
// instances share module scope, so subsequent requests within the same
// instance reuse this client instead of opening a new one.
//
// SECURITY: SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security.
//   - Never expose this key to the browser (no NEXT_PUBLIC_ prefix).
//   - Only import adminDb() in server-side code (Server Components,
//     Route Handlers, Server Actions, lib/ utilities).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

/**
 * Returns the shared service-role Supabase client.
 * Lazily initialises on the first call; returns the same instance thereafter.
 *
 * Usage:
 *   import { adminDb } from '@/lib/supabase/admin';
 *   const { data } = await adminDb().from('profiles').select('*');
 */
export function adminDb(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[adminDb] Missing Supabase credentials. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.',
    );
  }

  _admin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });

  return _admin;
}
