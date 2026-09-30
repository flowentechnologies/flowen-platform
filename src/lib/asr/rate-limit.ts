import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
// Separate from coaching: normal 15-second transcription chunks must not use
// the coach's 30/hour budget. At most 90 minutes of 15-second chunks per hour.
let limiter: Ratelimit | undefined;
const local = new Map<string, { count: number; reset: number }>();
export async function allowAsr(userId: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    limiter ??= new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(360, '1 h'), prefix: 'rl:asr' });
    return (await limiter.limit(userId)).success;
  }
  // Without a distributed limiter, do not silently leave paid production
  // requests unbounded across Vercel instances.
  if (process.env.NODE_ENV === 'production') return false;
  const now = Date.now(), previous = local.get(userId);
  const rec = previous && previous.reset > now ? previous : { count: 0, reset: now + 3600000 };
  rec.count++; local.set(userId, rec);
  return rec.count <= 360;
}
