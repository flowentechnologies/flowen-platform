import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create account — Flowen',
  description: 'Create your Flowen account to start practising speech fluency.',
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
