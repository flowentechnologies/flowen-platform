import type { Metadata } from 'next';
import { assertSlp } from '@/lib/slp/guard';
import SlpShell from '@/components/slp/SlpShell';

export const metadata: Metadata = {
  title: 'SLT Portal — Flowen',
  robots: { index: false, follow: false },
};

export default async function SlpLayout({ children }: { children: React.ReactNode }) {
  const user = await assertSlp();
  return (
    <SlpShell user={{ email: user.email, displayName: user.displayName }}>
      {children}
    </SlpShell>
  );
}
