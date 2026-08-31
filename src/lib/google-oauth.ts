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

  const json = await res.json() as { access_token?: string; error?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(`Google token refresh failed: ${json.error_description ?? json.error ?? 'unknown'}`);
  }
  return json.access_token;
}
