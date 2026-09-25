import { assertAdmin } from '@/lib/admin/guard';
import { OverviewClient } from './OverviewClient';

export default async function BookkeepingOverviewPage() {
  await assertAdmin();
  return <OverviewClient />;
}
