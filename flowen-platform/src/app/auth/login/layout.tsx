import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in — Flowen',
  description: 'Sign in to your Flowen account.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
