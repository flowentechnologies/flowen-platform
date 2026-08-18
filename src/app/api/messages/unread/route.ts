import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const admin = db();
  const { count } = await admin
    .from('slp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('to_user_id', user.id)
    .is('read_at', null);

  return NextResponse.json({ count: count ?? 0 });
}
