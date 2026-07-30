import { timingSafeEqual } from 'node:crypto';

export function verifyCronSecret(secret: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !secret) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(secret,   'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
