import { assertAdmin } from '@/lib/admin/guard';
import { SocialQueueClient } from './SocialQueueClient';
import { adminDb as db } from '@/lib/supabase/admin';

export interface SocialQueueRow {
  id: string;
  series: string;
  day_num: number | null;
  platform: 'instagram' | 'facebook' | 'linkedin';
  caption: string;
  hashtags: string;
  asset_path: string;
  asset_public_url: string | null;
  scheduled_at: string;
  status: 'pending' | 'published' | 'failed' | 'manual_pending' | 'manual_done' | 'skipped';
  published_at: string | null;
  external_post_id: string | null;
  error_message: string | null;
  attempt_count: number;
}

export default async function SocialPage() {
  await assertAdmin();

  const { data } = await db()
    .from('social_publish_queue')
    .select('*')
    .order('scheduled_at', { ascending: true });

  return <SocialQueueClient initialRows={(data ?? []) as SocialQueueRow[]} />;
}
