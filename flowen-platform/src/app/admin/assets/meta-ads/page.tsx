import { assertAdmin } from '@/lib/admin/guard';
import { adminDb } from '@/lib/supabase/admin';
import { MetaAdsClient } from './MetaAdsClient';

export const metadata = { title: 'Meta Ads Assets | Flowen Admin' };

export default async function MetaAdsPage() {
  await assertAdmin();

  const db = adminDb();

  // Fetch AI-generated video assets tagged for ads
  const { data: assets } = await db
    .from('asset_files')
    .select('id, name, public_url, file_size, created_at')
    .contains('tags', ['ai-generated'])
    .eq('mime_type', 'video/mp4')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/admin/assets" className="text-sm text-slate-400 hover:text-white transition-colors">Assets</a>
            <span className="text-slate-700">/</span>
            <span className="text-sm text-slate-300">Meta Ads</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Meta Ads Assets</h1>
          <p className="text-slate-400 text-sm mt-1">
            Generate AI video ads across all Meta placements simultaneously — Stories, Feed, Reels, and more
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/30">
            BytePlus Seedance 2.5
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            4 FORMATS
          </span>
        </div>
      </div>

      {/* Meta format overview strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Stories / Reels', dims: '1080×1920', ratio: '9:16', icon: '📱' },
          { label: 'Feed Square',     dims: '1080×1080', ratio: '1:1',  icon: '⬛' },
          { label: 'Feed Portrait',   dims: '1080×1440', ratio: '3:4',  icon: '📐' },
          { label: 'Feed Landscape',  dims: '1920×1080', ratio: '16:9', icon: '🖥' },
        ].map(f => (
          <div key={f.ratio} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-xl mb-2">{f.icon}</div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">{f.label}</p>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{f.dims} · {f.ratio}</p>
          </div>
        ))}
      </div>

      {/* Client panel */}
      <MetaAdsClient existingAssets={assets ?? []} />
    </div>
  );
}
