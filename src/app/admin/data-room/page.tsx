import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { DataRoomClient } from './DataRoomClient';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function DataRoomPage() {
  await assertAdmin();

  const db = adminDb();
  const [docsRes, invitesRes] = await Promise.all([
    db.from('data_room_documents').select('*').order('created_at', { ascending: false }),
    db.from('data_room_invites').select('*').order('created_at', { ascending: false }),
  ]);

  const documents = docsRes.data ?? [];
  const invites   = invitesRes.data ?? [];

  const totalSize     = documents.reduce((sum, d) => sum + (d.file_size ?? 0), 0);
  const activeInvites = invites.filter(i => !i.revoked && new Date(i.expires_at) > new Date()).length;

  function fmtBytes(b: number) {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  const lastUpdated = documents[0]?.created_at
    ? new Date(documents[0].created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Data Room</h1>
          <p className="text-slate-400 text-sm mt-1">Investor due diligence vault · private documents · access control</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
          CONFIDENTIAL
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Documents</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{documents.length}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{documents.length > 0 ? fmtBytes(totalSize) : '—'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Active Invites</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{activeInvites}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{invites.length} total</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Last Upload</p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight mt-1">{lastUpdated}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Storage</p>
          <p className="text-3xl font-black text-slate-900 dark:text-white">{documents.length > 0 ? fmtBytes(totalSize) : '0'}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">Supabase · private bucket</p>
        </div>
      </div>

      {/* Category breakdown */}
      {documents.length > 0 && (() => {
        const cats = documents.reduce<Record<string, number>>((a, d) => { a[d.category] = (a[d.category] ?? 0) + 1; return a; }, {});
        const catColors: Record<string, string> = {
          financial: 'bg-emerald-500/10 text-emerald-400',
          legal: 'bg-blue-500/10 text-blue-400',
          clinical: 'bg-purple-500/10 text-purple-400',
          technical: 'bg-orange-500/10 text-orange-400',
          corporate: 'bg-slate-600/40 text-slate-600 dark:text-slate-300',
          regulatory: 'bg-amber-500/10 text-amber-400',
        };
        return (
          <div className="flex flex-wrap gap-2">
            {Object.entries(cats).map(([cat, count]) => (
              <span key={cat} className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${catColors[cat] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}: {count}
              </span>
            ))}
          </div>
        );
      })()}

      {/* Main panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <DataRoomClient
          initialDocuments={documents}
          initialInvites={invites}
          siteUrl={siteUrl}
        />
      </div>
    </div>
  );
}
