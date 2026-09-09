/**
 * Shared Google OAuth2 access-token helper.
 * Trades a long-lived refresh_token for a short-lived access_token.
 *
 * Required env vars (set once, shared across Google Ads + GA4):
 *   GOOGLE_CLIENT_ID      — OAuth2 client ID (Google Cloud Console)
 *   GOOGLE_CLIENT_SECRET  — OAuth2 client secret
 *   GOOGLE_REFRESH_TOKEN  — offline refresh token (never expires unless revoked)
 */
export async function getGoogleAccessToken(): Promise<string> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN not configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  // Read as text first, not res.json() directly — a non-OAuth-shaped error
  // body (an HTML error page from a proxy/gateway in front of the token
  // endpoint, say) would otherwise throw inside a generic try-less parse
  // and surface as an opaque "Unexpected token <" with no HTTP status and
  // no body to look at. Parsed manually so a malformed body degrades to
  // the raw text instead of losing the failure entirely.
  const raw = await res.text();
  let json: { access_token?: string; error?: string; error_description?: string } = {};
  try { json = JSON.parse(raw); } catch { /* fall through with body-less json — raw still gets logged below */ }

  if (!json.access_token) {
    // Previously threw only `json.error_description ?? json.error ?? 'unknown'`
    // — when Google's response isn't the expected OAuth error shape (e.g. a
    // literal "Bad Request" with no error/error_description fields at all),
    // that collapsed to a single uninformative word with no HTTP status and
    // no way to see the real body without adding logging and redeploying
    // again. Now includes both up front.
    console.error(`[google-oauth] token refresh failed: HTTP ${res.status} ${res.statusText} — ${raw}`);
    const detail = json.error_description ?? json.error ?? raw.slice(0, 300) ?? 'unknown';
    throw new Error(`Google token refresh failed (HTTP ${res.status}): ${detail}`);
  }
  return json.access_token;
}
