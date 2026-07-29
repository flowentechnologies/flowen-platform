import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { MASTER_POLICIES } from '@/app/legal/policies';
import { ContentTabs } from './ContentTabs';

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const LEGAL_DOCS = [
  { key: 'privacyPolicy',      title: 'Privacy Policy & Data Protection Charter' },
  { key: 'termsOfService',     title: 'Terms of Service' },
  { key: 'cookiePolicy',       title: 'Cookie Policy & PECR Compliance' },
  { key: 'clinicalCompliance', title: 'Clinical Compliance Notice' },
  { key: 'governingLaw',       title: 'Governing Law & Dispute Resolution' },
] as const;

export default async function ContentPage() {
  await assertAdmin();

  const db = adminDb();

  const [consentRes, waitlistRes, profilesRes, foundingRes, activeSubsRes] = await Promise.all([
    db
      .from('consent_audit_log')
      .select('id, user_id, consent_type, action, version, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('waitlist_signups').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'founding'),
    db.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  // Enrich consent records with email from auth.users where possible
  const consentRows = consentRes.data ?? [];
  const uniqueUserIds = [...new Set(consentRows.map(r => r.user_id).filter(Boolean))];
  let emailMap: Record<string, string> = {};
  if (uniqueUserIds.length > 0) {
    const { data: authUsers } = await db
      .schema('auth')
      .from('users')
      .select('id,email')
      .in('id', uniqueUserIds.slice(0, 500));
    emailMap = Object.fromEntries((authUsers ?? []).map((u: { id: string; email: string }) => [u.id, u.email]));
  }

  const consentRecords = consentRows.map(r => ({
    ...r,
    email: emailMap[r.user_id] ?? null,
  }));

  const counts = {
    waitlist:           waitlistRes.count   ?? 0,
    all_users:          profilesRes.count   ?? 0,
    founding:           foundingRes.count   ?? 0,
    active_subscribers: activeSubsRes.count ?? 0,
  };

  const legalDocs = LEGAL_DOCS.map(d => ({
    key: d.key,
    title: d.title,
    content: (MASTER_POLICIES as Record<string, string>)[d.key] ?? '',
  }));

  const totalConsent = consentRecords.length;
  const legalDocCount = LEGAL_DOCS.length;
  const templateCount = 8;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Content</h1>
          <p className="text-slate-400 text-sm mt-1">
            Effective: <span className="text-slate-300">{MASTER_POLICIES.effectiveDate}</span>
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
          COMMUNICATIONS
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Email Templates</p>
          <p className="text-4xl font-black text-white">{templateCount}</p>
          <p className="text-xs text-slate-600 mt-1 font-mono">transactional</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Legal Documents</p>
          <p className="text-4xl font-black text-white">{legalDocCount}</p>
          <p className="text-xs text-slate-600 mt-1 font-mono">UK GDPR / PECR compliant</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <p className="text-xs font-mono text-slate-400 uppercase tracking-wide mb-2">Consent Records</p>
          <p className="text-4xl font-black text-white">{totalConsent}</p>
          <p className="text-xs text-slate-600 mt-1 font-mono">audit log entries</p>
        </div>
      </div>

      {/* Tabbed content */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <ContentTabs counts={counts} consentRecords={consentRecords} legalDocs={legalDocs} />
      </div>
    </div>
  );
}
