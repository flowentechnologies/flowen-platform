import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset password — Flowen',
  description: 'Send a password reset link to your email.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
