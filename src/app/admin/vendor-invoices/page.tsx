import { assertAdmin } from '@/lib/admin/guard';
import { VendorInvoicesClient } from './VendorInvoicesClient';

export default async function VendorInvoicesPage() {
  await assertAdmin();
  return <VendorInvoicesClient />;
}
