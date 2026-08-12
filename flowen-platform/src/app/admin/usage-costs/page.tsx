import { assertAdmin } from '@/lib/admin/guard';
import { fetchUsageCosts } from '@/app/api/admin/usage-costs/route';
import UsageCostsClient from './UsageCostsClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Usage & Costs — Flowen Admin',
};

// Never cache this page — data must be fresh
export const dynamic = 'force-dynamic';

export default async function UsageCostsPage() {
  await assertAdmin();
  const initialData = await fetchUsageCosts();

  return <UsageCostsClient initialData={initialData} />;
}
