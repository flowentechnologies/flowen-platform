import { assertAdmin } from '@/lib/admin/guard';
import IPClient from './IPClient';
import type { IPAsset, ModelVersion } from '@/app/api/admin/ip/route';
import { adminDb } from '@/lib/supabase/admin';

export default async function IPPage() {
  await assertAdmin();

  const db = adminDb();

  const [assetsRes, versionsRes] = await Promise.all([
    db.from('ip_assets').select('*').order('created_at', { ascending: false }),
    db.from('ip_model_versions').select('*').order('created_at', { ascending: false }),
  ]);

  const assets: IPAsset[] = assetsRes.data ?? [];
  const modelVersions: ModelVersion[] = versionsRes.data ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">IP Register</h1>
          <p className="text-slate-400 text-sm mt-1">
            Intellectual Property Portfolio · SEIS/EIS compliance · NHS procurement · Investor due diligence
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            PROPRIETARY
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            CONFIDENTIAL
          </span>
        </div>
      </div>

      <IPClient initialAssets={assets} initialVersions={modelVersions} />
    </div>
  );
}
