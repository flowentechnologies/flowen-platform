import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const adminDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function GET() {
  try {
    // 1. Get current user via SSR client
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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = adminDb();

    // 2. Look up customers table
    const { data: customer } = await admin
      .from('customers')
      .select('id, stripe_customer_id, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    // 3. Fetch profile tier
    const { data: profile } = await admin
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({
        hasSubscription: false,
        stripeCustomerId: null,
        status: null,
        tierInterval: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        tier: profile?.tier ?? null,
      });
    }

    // 4. Look up active subscription
    const { data: subscription } = await admin
      .from('subscriptions')
      .select(
        'stripe_subscription_id, status, tier_interval, current_period_end, cancel_at_period_end'
      )
      .eq('customer_id', customer.id)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Return billing status
    return NextResponse.json({
      hasSubscription: !!subscription,
      stripeCustomerId: customer.stripe_customer_id ?? null,
      status: subscription?.status ?? null,
      tierInterval: subscription?.tier_interval ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      tier: profile?.tier ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Billing status error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
