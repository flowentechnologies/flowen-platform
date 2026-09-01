import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/supabase/admin';
import { ReferralClient } from './ReferralClient';

export const metadata = { title: 'Refer a Friend — Flowen' };

export default async function ReferPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const admin = adminDb();

  // Fetch profile for name
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const name  = profile?.display_name ?? profile?.email?.split('@')[0] ?? 'User';
  const email = profile?.email ?? user.email ?? '';

  // Derive a stable referral code from the user's ID
  const refCode = `F-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  // Ensure an affiliate row exists for this user
  const { data: existing } = await admin
    .from('affiliates')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  let affiliateId = existing?.id ?? null;

  if (!affiliateId) {
    const { data: created } = await admin
      .from('affiliates')
      .insert({
        user_id:          user.id,
        name,
        email,
        code:             refCode,
        status:           'active',
        tier:             'standard',
        commission_pct:   0,   // user referrals earn recognition, not cash commission
        recurring_months: 0,
        channel:          'user_referral',
      })
      .select('id')
      .single();
    affiliateId = created?.id ?? null;
  }

  // Click count for this affiliate
  let clickCount = 0;
  if (affiliateId) {
    const { count } = await admin
      .from('affiliate_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', affiliateId);
    clickCount = count ?? 0;
  }

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';
  const referralUrl = `${SITE}/?ref=${refCode}`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-1">
          Spread the word
        </p>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Refer a friend
        </h1>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
          Know someone who stutters or has a child who does? Send them your link — they get full access to the 7-day trial.
        </p>
      </div>

      <ReferralClient referralUrl={referralUrl} refCode={refCode} clickCount={clickCount} />

      {/* Who to share with */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Who benefits most
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '🗣️', label: 'Adults who stutter', desc: 'Looking for daily practice between therapy sessions' },
            { icon: '🧒', label: 'Parents of children who stammer', desc: 'Wanting structured at-home practice tools' },
            { icon: '🏥', label: 'NHS speech therapy patients', desc: 'On a waiting list or supplementing existing therapy' },
            { icon: '💼', label: 'Professionals', desc: 'Managing stutter in meetings, presentations, and calls' },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex gap-3">
              <span className="text-lg shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-200 leading-tight">{label}</p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
