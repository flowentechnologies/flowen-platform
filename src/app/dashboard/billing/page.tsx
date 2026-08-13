import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BillingClient, type BillingProps } from './BillingClient';

const adminDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

async function getBillingData(): Promise<BillingProps | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = adminDb();

  // Fetch customer and profile in parallel
  const [{ data: customer }, { data: profile }] = await Promise.all([
    admin
      .from('customers')
      .select('id, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  if (!customer) {
    return {
      hasSubscription: false,
      stripeCustomerId: null,
      status: null,
      tierInterval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      tier: profile?.tier ?? null,
    };
  }

  // Fetch active subscription
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('status, tier_interval, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    hasSubscription: !!subscription,
    stripeCustomerId: (customer.stripe_customer_id as string | null) ?? null,
    status: (subscription?.status as string | null) ?? null,
    tierInterval: (subscription?.tier_interval as string | null) ?? null,
    currentPeriodEnd: (subscription?.current_period_end as string | null) ?? null,
    cancelAtPeriodEnd: (subscription?.cancel_at_period_end as boolean | null) ?? false,
    tier: (profile?.tier as string | null) ?? null,
  };
}

export default async function BillingPage() {
  const billingData = await getBillingData();

  if (!billingData) {
    redirect('/auth/login');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Billing</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your subscription and payment details
        </p>
      </div>

      <BillingClient {...billingData} />
    </div>
  );
}
