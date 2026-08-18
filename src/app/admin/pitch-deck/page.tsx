import { assertAdmin } from '@/lib/admin/guard';
import { PitchDeckClient } from './PitchDeckClient';
import type { DeckInvite } from '@/app/api/admin/pitch-deck/route';
import { adminDb as db } from '@/lib/supabase/admin';

export default async function PitchDeckPage() {
  await assertAdmin();

  const [invitesRes, viewsRes] = await Promise.all([
    db().from('deck_invites').select('*').order('created_at', { ascending: false }),
    db().from('deck_views').select('invite_id, viewed_at').order('viewed_at', { ascending: false }).limit(200),
  ]);

  const invites: DeckInvite[] = invitesRes.error ? [] : (invitesRes.data ?? []);
  const views = viewsRes.error ? [] : (viewsRes.data ?? []);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

  return <PitchDeckClient initialInvites={invites} recentViews={views} siteUrl={siteUrl} />;
}
