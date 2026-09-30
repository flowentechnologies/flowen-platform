import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';

export const dynamic = 'force-dynamic';

// Temporary, admin-only, read-only diagnostic. Fails closed after this window.
const EXPIRES_AT = Date.parse('2026-09-30T12:00:00Z');
const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  if (Date.now() >= EXPIRES_AT) {
    return new NextResponse(null, { status: 404, headers: noStore });
  }
  try { await assertAdmin(); } catch {
    return new NextResponse(null, { status: 403, headers: noStore });
  }

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/\D/g, '') ?? null;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, '') ?? null;
  let scope: string | null = null;
  let accessibleCustomerIds: string[] | null = null;

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (clientId && clientSecret && refreshToken && developerToken) {
      const refreshed = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token', client_id: clientId,
          client_secret: clientSecret, refresh_token: refreshToken,
        }),
      });
      const token: { access_token?: string; scope?: string } = await refreshed.json();
      if (refreshed.ok && token.access_token) {
        scope = typeof token.scope === 'string' ? token.scope : null;
        const accessible = await fetch('https://googleads.googleapis.com/v25/customers:listAccessibleCustomers', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'developer-token': developerToken,
          },
        });
        const result: { resourceNames?: string[] } = await accessible.json();
        if (accessible.ok && Array.isArray(result.resourceNames)) {
          accessibleCustomerIds = result.resourceNames
            .filter((name): name is string => typeof name === 'string' && /^customers\/\d+$/.test(name))
            .map(name => name.replace('customers/', ''));
        }
      }
    }
  } catch {
    // Never log or return upstream bodies, credentials, or exception details.
  }

  return NextResponse.json({ scope, customerId, loginCustomerId, accessibleCustomerIds }, { headers: noStore });
}
