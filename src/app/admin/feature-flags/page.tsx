import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { FeatureFlagsClient } from './FeatureFlagsClient';
import type { FeatureFlag } from '@/app/api/admin/feature-flags/route';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function FeatureFlagsPage() {
  await assertAdmin();

  const { data } = await db()
    .from('feature_flags')
    .select('*')
    .order('name', { ascending: true });

  const flags = (data ?? []) as FeatureFlag[];

  return <FeatureFlagsClient initialFlags={flags} />;
}
