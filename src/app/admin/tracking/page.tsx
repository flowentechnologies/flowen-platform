import { assertAdmin } from '@/lib/admin/guard';
import { TrackingClient } from './TrackingClient';
import { adminDb as db } from '@/lib/supabase/admin';

export interface TrackingRow {
  id: string;
  provider_key: string;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
  consent_required: boolean;
  pixel_id: string | null;
  head_html: string | null;
  body_html: string | null;
  server_config: Record<string, string>;
  sort_order: number;
  updated_at: string;
}

export default async function TrackingPage() {
  await assertAdmin();

  const { data } = await db()
    .from('tracking_providers')
    .select('*')
    .order('sort_order');

  return <TrackingClient initialProviders={(data ?? []) as TrackingRow[]} />;
}
