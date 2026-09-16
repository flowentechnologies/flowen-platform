import { assertAdmin } from '@/lib/admin/guard';
import { RecordingsClient } from './RecordingsClient';

export default async function RecordingsPage() {
  await assertAdmin();
  return <RecordingsClient />;
}
