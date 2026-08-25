import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HistoryClient } from './HistoryClient';

export type PracticeSession = {
  id: string;
  stage_id: number | null;
  duration_seconds: number;
  total_blocks_detected: number;
  total_repetitions_detected: number;
  total_prolongations_detected: number;
  created_at: string;
  transcript: string | null;
  has_recording: boolean;
};

export default async function HistoryPage() {
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
  if (!user) redirect('/auth/login');

  const { data: rawSessions } = await supabase
    .from('practice_sessions')
    .select(
      'id,stage_id,duration_seconds,total_blocks_detected,total_repetitions_detected,total_prolongations_detected,created_at,transcript,audio_storage_path'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500);

  const sessions: PracticeSession[] = (rawSessions ?? []).map((s) => ({
    id:                           s.id,
    stage_id:                     s.stage_id,
    duration_seconds:             s.duration_seconds,
    total_blocks_detected:        s.total_blocks_detected,
    total_repetitions_detected:   s.total_repetitions_detected,
    total_prolongations_detected: s.total_prolongations_detected,
    created_at:                   s.created_at,
    transcript:                   s.transcript,
    has_recording:                !!(s as { audio_storage_path?: string | null }).audio_storage_path,
  }));

  return <HistoryClient sessions={sessions} />;
}
