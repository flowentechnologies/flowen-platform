import { Suspense } from 'react';
import { assertAdmin } from '@/lib/admin/guard';
import { InboxClient } from './InboxClient';

export default async function InboxPage() {
  await assertAdmin();
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <InboxClient />
    </Suspense>
  );
}
