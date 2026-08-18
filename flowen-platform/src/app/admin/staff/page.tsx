import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertAdmin } from '@/lib/admin/guard';
import { StaffClient } from './StaffClient';
import { adminDb } from '@/lib/supabase/admin';

export default async function StaffPage() {
  await assertAdmin();

  const cookieStore = await cookies();
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { user } } = await anonClient.auth.getUser();
  const adminEmail = user?.email ?? '';

  const db = adminDb();

  const [profilesRes, authRes, staffMetaRes, invitesRes, handoffsRes] = await Promise.all([
    db.from('profiles').select('id,display_name,is_admin,created_at').eq('is_admin', true),
    db.schema('auth').from('users').select('id,email,last_sign_in_at,created_at'),
    db.from('staff_members').select('*'),
    db.from('staff_invites').select('*').order('created_at', { ascending: false }),
    db.from('handoff_notes').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  const profiles  = profilesRes.data  ?? [];
  const authUsers = (authRes.data     ?? []) as { id: string; email: string; last_sign_in_at: string | null; created_at: string }[];
  const staffMeta = staffMetaRes.data ?? [];
  const invites   = invitesRes.data   ?? [];
  const handoffs  = handoffsRes.data  ?? [];

  const authMap = Object.fromEntries(authUsers.map(u => [u.id, u]));
  const metaMap = Object.fromEntries(staffMeta.map(m => [m.id, m]));

  const members = profiles.map(p => ({
    id:              p.id,
    email:           authMap[p.id]?.email ?? null,
    display_name:    p.display_name ?? null,
    last_sign_in_at: authMap[p.id]?.last_sign_in_at ?? null,
    profile_created: p.created_at,
    role:            (metaMap[p.id]?.role ?? 'admin') as 'owner' | 'admin' | 'developer' | 'support' | 'analyst' | 'clinical' | 'marketing',
    department:      metaMap[p.id]?.department ?? null,
    title:           metaMap[p.id]?.title ?? null,
    bio:             metaMap[p.id]?.bio ?? null,
    status:          (metaMap[p.id]?.status ?? 'active') as 'active' | 'inactive' | 'suspended',
    joined_at:       metaMap[p.id]?.joined_at ?? p.created_at,
  }));

  const activeInvites   = invites.filter(i => !i.revoked && !i.accepted_at && new Date(i.expires_at) > new Date()).length;
  const acceptedInvites = invites.filter(i => i.accepted_at).length;
  const siteUrl         = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

  const roles = [...new Set(members.map(m => m.role))];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Staff</h1>
          <p className="text-slate-400 text-sm mt-1">Team roster · roles · invites · shift handoff</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
          INTERNAL
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Team Members</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{members.length}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{members.filter(m => m.status === 'active').length} active</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Active Roles</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{roles.length}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{roles.join(', ')}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide mb-2">Pending Invites</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{activeInvites}</p>
          <p className="text-[10px] text-slate-600 mt-1 font-mono">{acceptedInvites} accepted</p>
        </div>
      </div>

      {/* Board */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <StaffClient
          initialMembers={members}
          initialInvites={invites}
          initialHandoffs={handoffs}
          adminEmail={adminEmail}
          siteUrl={siteUrl}
        />
      </div>
    </div>
  );
}
