import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { adminDb } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user }, error: authError } = await ssr.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = adminDb();

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('tier, brand')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[billing/status] profile query error:', profileError.message);
      return NextResponse.json({ error: 'Failed to load billing status' }, { status: 500 });
    }

    return NextResponse.json({
      tier:   profile?.tier   ?? 'free',
      brand:  profile?.brand  ?? null,
      userId: user.id,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[billing/status] unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
