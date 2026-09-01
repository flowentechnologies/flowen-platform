/**
 * getUserFromRequest
 *
 * Extracts the authenticated Supabase user from an incoming Request.
 * Supports two auth paths:
 *
 *   1. Cookie-based (web app, SSR) — existing behaviour via createClient()
 *   2. Bearer token (mobile app) — `Authorization: Bearer <access_token>`
 *
 * Returns null if no valid session is found.
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export async function getUserFromRequest(req: Request): Promise<User | null> {
  // ── 1. Bearer token path (mobile / API clients) ───────────────────────────
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      // Create a lightweight anonymous client, then set the session from the token.
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      const { data } = await anonClient.auth.getUser(token);
      if (data.user) return data.user;
    }
  }

  // ── 2. Cookie path (web app) ───────────────────────────────────────────────
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}
