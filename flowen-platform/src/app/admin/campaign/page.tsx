import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { CampaignBoard } from './CampaignBoard';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function CampaignPage() {
  await assertAdmin();

  const db = adminDb();
  const [milestonesRes, contactsRes, pressRes, profilesRes] = await Promise.all([
    db.from('campaign_milestones').select('*').order('target_date', { ascending: true }),
    db.from('campaign_contacts').select('*').order('created_at', { ascending: false }),
    db.from('campaign_press_links').select('*').order('published_date', { ascending: false }),
    db.from('profiles').select('*', { count: 'exact', head: true }),
  ]);

  const milestones = milestonesRes.data ?? [];
  const contacts   = contactsRes.data   ?? [];
  const press      = pressRes.data       ?? [];

  const achieved      = milestones.filter(m => m.status === 'achieved').length;
  const supporting    = contacts.filter(c => c.status === 'supporting').length;
  const positivePress = press.filter(p => p.sentiment === 'positive').length;
  const totalUsers    = profilesRes.count ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Campaign</h1>
          <p className="text-slate-400 text-sm mt-1">Parliamentary petition · NHS adoption · Influencers · Press</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          ADVOCACY
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Milestones</p>
          <p className="text-3xl font-black text-white">{achieved}<span className="text-slate-600 text-lg font-bold">/{milestones.length}</span></p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">achieved</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Contacts</p>
          <p className="text-3xl font-black text-white">{contacts.length}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{supporting} supporting</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Press</p>
          <p className="text-3xl font-black text-white">{press.length}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{positivePress} positive</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Platform Users</p>
          <p className="text-3xl font-black text-white">{totalUsers}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">signed up</p>
        </div>
      </div>

      {/* Board */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <CampaignBoard
          initialMilestones={milestones}
          initialContacts={contacts}
          initialPress={press}
        />
      </div>
    </div>
  );
}
