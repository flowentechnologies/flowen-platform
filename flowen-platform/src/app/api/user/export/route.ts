import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  const cookieStore = await cookies();
  const ssr = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = db();

  const [{ data: sessions }, { data: profile }] = await Promise.all([
    admin
      .from('practice_sessions')
      .select('id,stage_id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    admin
      .from('profiles')
      .select('display_name,email')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify({
    exported_at: new Date().toISOString(),
    user: {
      email: user.email ?? profile?.email ?? '',
      display_name: profile?.display_name ?? '',
    },
    sessions: sessions ?? [],
  }, null, 2);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="flowen-export-${today}.json"`,
    },
  });
}
