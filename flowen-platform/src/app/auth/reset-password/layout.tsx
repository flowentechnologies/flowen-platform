import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set new password — Flowen',
  description: 'Choose a new password for your Flowen account.',
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
