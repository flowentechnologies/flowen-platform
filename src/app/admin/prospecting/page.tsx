import { Suspense } from 'react';
import { assertAdmin } from '@/lib/admin/guard';
import { ProspectingClient } from './ProspectingClient';

export default async function ProspectingPage() {
  await assertAdmin();
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <ProspectingClient />
    </Suspense>
  );
}
