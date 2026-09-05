import { Suspense } from 'react';
import { assertAdmin } from '@/lib/admin/guard';
import { CrmClient } from './CrmClient';

export default async function CrmPage() {
  await assertAdmin();
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <CrmClient />
    </Suspense>
  );
}
