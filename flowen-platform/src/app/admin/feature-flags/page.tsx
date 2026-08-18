import { assertAdmin } from '@/lib/admin/guard';
import { FeatureFlagsClient } from './FeatureFlagsClient';
import type { FeatureFlag } from '@/app/api/admin/feature-flags/route';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function FeatureFlagsPage() {
  await assertAdmin();

  const { data } = await db()
    .from('feature_flags')
    .select('*')
    .order('name', { ascending: true });

  const flags = (data ?? []) as FeatureFlag[];

  return <FeatureFlagsClient initialFlags={flags} />;
}
