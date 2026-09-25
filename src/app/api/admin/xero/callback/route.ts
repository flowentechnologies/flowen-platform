/**
 * GET /api/admin/xero/callback
 *
 * Completes the OAuth flow started by /connect?entity=...: exchanges the
 * authorization code for an access + refresh token, discovers which Xero
 * organisation ("tenant") the connection grants access to, and stores
 * everything in xero_oauth_tokens under the entity that started the flow
 * (carried through in the xero_oauth_entity cookie, since Xero's redirect
 * only echoes back `code` and `state`). Xero tokens are user-scoped, not
 * organisation-scoped, which is why the tenant lookup (fetchXeroConnections)
 * is a separate call after the token exchange — see src/lib/xero.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { fetchXeroConnections, decodeXeroAuthEventId } from '@/lib/xero';
import { isXeroEntitySlug } from '@/lib/flowen-entities';

const REDIRECT_URI = 'https://www.flowen.digital/api/admin/xero/callback';
const TOKEN_URL = 'https://identity.xero.com/connect/token';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expectedState = req.cookies.get('xero_oauth_state')?.value;
  const entity = req.cookies.get('xero_oauth_entity')?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: 'Invalid OAuth state or missing code' }, { status: 400 });
  }
  if (!entity || !isXeroEntitySlug(entity)) {
    return NextResponse.json({ error: 'Missing or invalid entity — the connect flow must be started via /api/admin/xero/connect?entity=...' }, { status: 400 });
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Xero app credentials not configured' }, { status: 500 });
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  const tokenBody = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenBody.access_token) {
    return NextResponse.json({ error: tokenBody.error_description ?? 'Token exchange failed' }, { status: 500 });
  }

  let tenant: { tenantId: string; tenantName: string } | undefined;
  let ambiguous = false;
  try {
    const connections = await fetchXeroConnections(tokenBody.access_token);
    // GET /connections returns every org this Xero user has EVER authorised
    // for this app, not just the one(s) just granted — with more than one
    // entity connected, connections[0] would silently pick an arbitrary
    // stale connection instead of this flow's actual grant. Scope down using
    // the id_token's authentication_event_id claim, which matches each
    // connection's own authEventId only for the org(s) granted just now.
    const authEventId = decodeXeroAuthEventId(tokenBody.id_token);
    const scoped = authEventId ? connections.filter(c => c.authEventId === authEventId) : connections;
    tenant = scoped[0] ?? connections[0];
    ambiguous = scoped.length > 1;
    // TEMPORARY diagnostic — the authEventId scoping above didn't actually
    // pick the right tenant on the last live attempt, so log everything
    // needed to see why before guessing at another fix. Remove once fixed.
    let idTokenClaims: unknown = null;
    if (tokenBody.id_token) {
      try {
        idTokenClaims = JSON.parse(Buffer.from(tokenBody.id_token.split('.')[1], 'base64url').toString('utf8'));
      } catch (e) {
        idTokenClaims = `decode failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    console.log('[xero][debug]', JSON.stringify({ entity, connections, authEventId, scopedCount: scoped.length, idTokenClaims }));
  } catch (err) {
    console.error('[xero] connections lookup failed:', err);
  }

  const expiresAt = tokenBody.expires_in
    ? new Date(Date.now() + tokenBody.expires_in * 1000).toISOString()
    : null;

  await db().from('xero_oauth_tokens').upsert({
    entity,
    tenant_id: tenant?.tenantId ?? null,
    tenant_name: tenant?.tenantName ?? null,
    access_token: tokenBody.access_token,
    refresh_token: tokenBody.refresh_token ?? null,
    expires_at: expiresAt,
    scope: tokenBody.scope ?? null,
    updated_at: new Date().toISOString(),
  });

  const redirectUrl = new URL('/admin/bookkeeping', req.url);
  redirectUrl.searchParams.set('xero', tenant ? 'connected' : 'connected_no_tenant');
  redirectUrl.searchParams.set('entity', entity);
  if (ambiguous) {
    // More than one organisation was granted in this single consent — we
    // picked one, but which one is arbitrary. Flag it so the admin knows to
    // check /admin/bookkeeping shows the right tenant name for this entity,
    // and redo the connect selecting only one org if not.
    redirectUrl.searchParams.set('xero_ambiguous', '1');
  }

  const res = NextResponse.redirect(redirectUrl);
  res.cookies.delete('xero_oauth_state');
  res.cookies.delete('xero_oauth_entity');
  return res;
}
