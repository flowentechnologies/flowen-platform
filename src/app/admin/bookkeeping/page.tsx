import { assertAdmin } from '@/lib/admin/guard';
import { BookkeeperClient } from './BookkeeperClient';

export default async function BookkeepingPage() {
  await assertAdmin();
  return <BookkeeperClient />;
}
