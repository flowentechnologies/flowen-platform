import { assertAdmin } from '@/lib/admin/guard';
import { AssetsClient } from './AssetsClient';
import { adminDb } from '@/lib/supabase/admin';

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AssetsPage() {
  await assertAdmin();

  const db = adminDb();
  const { data: assets } = await db
    .from('asset_files')
    .select('*')
    .order('created_at', { ascending: false });

  const rows = assets ?? [];

  const totalSize = rows.reduce((sum, a) => sum + (a.file_size ?? 0), 0);
  const foldersUsed = new Set(rows.map(a => a.folder)).size;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Assets</h1>
          <p className="text-slate-400 text-sm mt-1">Public CDN asset library · images, audio, video, documents</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
          PUBLIC CDN
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Total Assets</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{rows.length}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">across all folders</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Storage Used</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{rows.length > 0 ? fmtBytes(totalSize) : '0 B'}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">Supabase Storage · public bucket</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Folders Used</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{foldersUsed}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">of 6 available</p>
        </div>
      </div>

      {/* Main panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <AssetsClient initialAssets={rows} />
      </div>
    </div>
  );
}
