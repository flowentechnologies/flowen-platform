import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) return NextResponse.json({ count: 0 });

    const admin = db();
    const { count, error } = await admin
      .from('slp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_user_id', user.id)
      .is('read_at', null);

    if (error) {
      console.error('[messages/unread] db error:', error.message);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    console.error('[messages/unread] unexpected error:', err);
    return NextResponse.json({ count: 0 });
  }
}
