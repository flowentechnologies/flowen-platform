import { Suspense } from 'react';
import { assertAdmin } from '@/lib/admin/guard';
import { OutreachClient } from './OutreachClient';

export default async function OutreachPage() {
  await assertAdmin();
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <OutreachClient />
    </Suspense>
  );
}
