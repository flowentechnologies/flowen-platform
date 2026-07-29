import { assertAdmin } from '@/lib/admin/guard';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertAdmin();

  return <AdminShell>{children}</AdminShell>;
}
