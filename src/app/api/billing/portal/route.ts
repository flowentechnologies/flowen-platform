import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getStripeClient } from '@/lib/stripe';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

const adminDb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

export async function POST() {
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

    // 2. Look up customers table
    const admin = adminDb();
    const { data: customer } = await admin
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    // 3. No customer row or no stripe_customer_id
    if (!customer || !customer.stripe_customer_id) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 400 });
    }

    // 4. Create billing portal session (uses mode from app_config)
    const { client } = await getStripeClient();
    const session = await client.billingPortal.sessions.create({
      customer: customer.stripe_customer_id as string,
      return_url: `${baseUrl}/dashboard/billing`,
    });

    // 5. Return URL
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('Billing portal error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
