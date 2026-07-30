import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { TrackingClient } from './TrackingClient';

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

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function TrackingPage() {
  await assertAdmin();

  const { data } = await db()
    .from('tracking_providers')
    .select('*')
    .order('sort_order');

  return <TrackingClient initialProviders={(data ?? []) as TrackingRow[]} />;
}
