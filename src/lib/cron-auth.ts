import { timingSafeEqual } from 'node:crypto';

export function verifyCronSecret(secret: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !secret) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(secret,   'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Accepts both the x-cron-secret header (admin manual trigger via POST)
// and Authorization: Bearer <secret> (Vercel scheduled cron via GET).
export function verifyCronRequest(headers: { get(name: string): string | null }): boolean {
  const fromHeader  = headers.get('x-cron-secret');
  const fromBearer  = headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  return verifyCronSecret(fromHeader) || verifyCronSecret(fromBearer);
}
