import { assertAdmin } from '@/lib/admin/guard';
import { ConsistencyClient } from './ConsistencyClient';

export default async function ConsistencyPage() {
  await assertAdmin();
  return <ConsistencyClient />;
}
