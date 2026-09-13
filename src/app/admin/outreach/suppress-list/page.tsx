import { Suspense } from 'react';
import { assertAdmin } from '@/lib/admin/guard';
import { SuppressListClient } from './SuppressListClient';

export default async function SuppressListPage() {
  await assertAdmin();
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <SuppressListClient />
    </Suspense>
  );
}
