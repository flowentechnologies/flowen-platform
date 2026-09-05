import { assertAdmin } from '@/lib/admin/guard';
import { CrmClient } from './CrmClient';

export default async function CrmPage() {
  await assertAdmin();
  return <CrmClient />;
}
