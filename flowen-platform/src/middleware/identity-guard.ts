import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Paths that must be reachable even when id_verified = false.
// The verification page itself and the DIDIT callback API are always exempt.
const EXEMPT_PREFIXES = [
  '/portal/verify-identity',
  '/api/identity/',
  '/api/didit/',
] as const;

function isExempt(pathname: string): boolean {
  return EXEMPT_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/**
 * Composable identity guard for the Next.js proxy layer.
 *
 * Checks `profiles.id_verified` for the authenticated user. If the column
 * is false or null, redirects to the Didit KYC onboarding page and preserves
 * the original destination in `returnTo` so the user lands back after passing.
 *
 * Returns `null` to pass through, or a `NextResponse.redirect` to block.
 *
 * Design notes:
 * - The `id_verified` column is added by the 20260728_security_policies.sql
 *   migration. If the column is absent (pre-migration), the guard treats the
 *   error as "not blocking" to prevent a hard lock-out during rollout.
 * - The guard runs only for /portal paths. The caller (proxy.ts) is
 *   responsible for skipping this entirely for unauthenticated users.
 * - The Supabase client is the same one already hydrated with the user's
 *   session cookies — RLS will allow the SELECT on their own profile row.
 */
export async function applyIdentityGuard(
  request: NextRequest,
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  if (isExempt(pathname)) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id_verified')
    .eq('id', userId)
    .maybeSingle();

  // Column doesn't exist yet (pre-migration) or RLS denied — pass through.
  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[identity-guard] profiles query error:', error.message);
    }
    return null;
  }

  // No profile row yet (new user before trigger fires) — pass through.
  if (!profile) return null;

  // id_verified = false OR null (column added but not yet set) → block.
  if (profile.id_verified === false || profile.id_verified === null) {
    const dest = new URL('/portal/verify-identity', request.url);
    dest.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(dest);
  }

  return null;
}
