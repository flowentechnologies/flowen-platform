import { createClient } from '@supabase/supabase-js';

// Deterministic hash of userId → number 0..99 for rollout_pct check
function rolloutBucket(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % 100;
}

export async function isFeatureEnabled(
  key: string,
  userId: string,
  tier: string | null,
): Promise<boolean> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data } = await client
    .from('feature_flags')
    .select('enabled,rollout_pct,allowed_tiers')
    .eq('key', key)
    .maybeSingle();
  if (!data || !data.enabled) return false;
  if (data.allowed_tiers?.length && !data.allowed_tiers.includes(tier ?? '')) return false;
  return rolloutBucket(userId) < data.rollout_pct;
}
