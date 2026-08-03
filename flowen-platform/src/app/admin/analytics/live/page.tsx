import { requireAdmin } from '@/lib/admin/guard';
import { redirect } from 'next/navigation';
import LiveClient from './LiveClient';

export const metadata = { title: 'Live Analytics — Flowen Admin' };

export default async function LiveAnalyticsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect('/auth/login');

  return (
    <div className="min-h-screen bg-[#06080F] px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Live Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time visitor tracking, geo, and paid channel attribution</p>
        </div>
        <LiveClient />
      </div>
    </div>
  );
}
