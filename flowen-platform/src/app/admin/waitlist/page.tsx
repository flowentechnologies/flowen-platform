import { createClient } from '@supabase/supabase-js';
import { assertAdmin } from '@/lib/admin/guard';
import { WaitlistClient } from './WaitlistClient';
import type { WaitlistSignup } from '@/app/api/admin/waitlist/route';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface WaitlistRow {
  id: string;
  email: string;
  source: string;
  created_at: string;
  invited_at: string | null;
  invite_expires_at: string | null;
  converted_at: string | null;
}

function computeStatus(
  row: Pick<WaitlistRow, 'invited_at' | 'invite_expires_at' | 'converted_at'>,
): WaitlistSignup['status'] {
  if (row.converted_at !== null) return 'converted';
  if (row.invited_at !== null && row.invite_expires_at !== null) {
    if (new Date(row.invite_expires_at) > new Date()) return 'invited';
    return 'expired';
  }
  return 'not_invited';
}

export default async function WaitlistPage() {
  await assertAdmin();

  const { data } = await db()
    .from('waitlist_signups')
    .select('id, email, source, created_at, invited_at, invite_expires_at, converted_at')
    .order('created_at', { ascending: false });

  const signups: WaitlistSignup[] = ((data ?? []) as WaitlistRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    source: row.source,
    created_at: row.created_at,
    invited_at: row.invited_at,
    invite_expires_at: row.invite_expires_at,
    converted_at: row.converted_at,
    status: computeStatus(row),
  }));

  return <WaitlistClient initialSignups={signups} />;
}
