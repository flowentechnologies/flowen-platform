import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Admin | Flowen',
  robots: { index: false, follow: false },
};

export default function AdminRoot() {
  redirect('/admin/command-center');
}
