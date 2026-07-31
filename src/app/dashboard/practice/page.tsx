import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PracticeClient } from './PracticeClient';

export default async function PracticePage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: recentSessions } = await supabase
    .from('practice_sessions')
    .select('id,duration_seconds,total_blocks_detected,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { count } = await supabase
    .from('practice_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const totalSessions = count ?? 0;
  const recommendedStage = Math.min(5, Math.floor(totalSessions / 5) + 1);

  return (
    <PracticeClient
      recommendedStage={recommendedStage}
      recentSessions={(recentSessions ?? []).map(s => ({
        id: s.id,
        duration_seconds: s.duration_seconds,
        total_blocks_detected: s.total_blocks_detected,
        created_at: s.created_at,
        bpm:
          s.duration_seconds > 0
            ? Math.round((s.total_blocks_detected / (s.duration_seconds / 60)) * 10) / 10
            : 0,
      }))}
    />
  );
}
