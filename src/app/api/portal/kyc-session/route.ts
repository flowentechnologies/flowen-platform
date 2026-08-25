/**
 * POST /api/portal/kyc-session
 *
 * Creates a Didit identity-verification session for the authenticated user and
 * returns the redirect URL.  The Flowen user UUID is passed as `vendor_data` so
 * the webhook at /api/identity/verify can resolve the user when Didit posts back.
 *
 * Didit session-creation docs:
 *   https://docs.didit.me/identity-verification/api-reference/create-session
 *
 * Required env vars:
 *   DIDIT_CLIENT_ID      — OAuth2 client ID from the Didit console
 *   DIDIT_CLIENT_SECRET  — OAuth2 client secret from the Didit console
 *   NEXT_PUBLIC_SITE_URL — Base URL for the success/failure redirects
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DIDIT_API = 'https://apx.didit.me';
const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

async function getDiditAccessToken(): Promise<string> {
  const clientId     = process.env.DIDIT_CLIENT_ID;
  const clientSecret = process.env.DIDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('DIDIT_CLIENT_ID / DIDIT_CLIENT_SECRET not configured');
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${DIDIT_API}/auth/v2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Didit token error ${res.status}: ${text}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function POST() {
  // Require authentication — vendor_data must be a real Flowen user UUID
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const accessToken = await getDiditAccessToken();

    const sessionRes = await fetch(`${DIDIT_API}/v1/session/`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        vendor_data:  user.id,          // Flowen UUID — echoed back in webhook
        callback:     `${SITE_URL}/api/identity/verify`,
        redirect_url: `${SITE_URL}/portal/verify-identity?status=complete`,
        features:     'OCR + FACE',     // Document + liveness check
      }),
    });

    if (!sessionRes.ok) {
      const text = await sessionRes.text();
      console.error('[kyc-session] Didit session error:', sessionRes.status, text);
      return NextResponse.json(
        { error: 'Could not create verification session' },
        { status: 502 },
      );
    }

    const session = await sessionRes.json() as { url: string; session_id: string };

    return NextResponse.json({ url: session.url, session_id: session.session_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';

    // Distinguish "not configured" (setup gap) from real API failures
    if (msg.includes('not configured')) {
      return NextResponse.json({ error: 'not_configured' }, { status: 503 });
    }

    console.error('[kyc-session] error:', msg);
    return NextResponse.json({ error: 'Verification unavailable' }, { status: 500 });
  }
}
