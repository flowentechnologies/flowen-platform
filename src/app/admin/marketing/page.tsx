import type { Metadata } from 'next';
import { assertAdmin } from '@/lib/admin/guard';
import { MarketingClient } from './MarketingClient';

export const metadata: Metadata = {
  title: 'Marketing Intelligence | Flowen Admin',
  robots: { index: false, follow: false },
};

export default async function MarketingPage() {
  await assertAdmin();
  return <MarketingClient />;
}
