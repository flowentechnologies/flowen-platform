import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { randomBytes } from 'crypto';
import { logAuditEvent } from '@/lib/admin/audit';
import { adminDb as db } from '@/lib/supabase/admin';

export interface DeckInvite {
  id: string;
  investor_name: string;
  investor_email: string | null;
  token: string;
  created_at: string;
  expires_at: string | null;
  revoked: boolean;
  view_count: number;
  last_viewed_at: string | null;
  firm: string | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('deck_invites')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ invites: [] });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  const client = db();

  if (action === 'create') {
    const { investor_name, investor_email, firm, expires_days } = body;
    if (!investor_name) return NextResponse.json({ error: 'investor_name required' }, { status: 400 });

    const token = randomBytes(24).toString('base64url');
    const expires_at = expires_days
      ? new Date(Date.now() + Number(expires_days) * 86400_000).toISOString()
      : null;

    const { data, error } = await client.from('deck_invites').insert({
      investor_name, investor_email: investor_email || null,
      firm: firm || null, token, expires_at, view_count: 0, revoked: false,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'deck.invite_created', resource_type: 'deck_invite', resource_id: data.id, metadata: { investor_name, investor_email: investor_email || null }, severity: 'info' });
    return NextResponse.json({ invite: data });
  }

  if (action === 'revoke') {
    const { id } = body;
    const { data: invite } = await client.from('deck_invites').select('investor_name').eq('id', id).single();
    const { error } = await client.from('deck_invites').update({ revoked: true }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'deck.invite_revoked', resource_type: 'deck_invite', resource_id: id, metadata: { investor_name: invite?.investor_name ?? null }, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const { id } = body;
    await client.from('deck_views').delete().eq('invite_id', id);
    const { error } = await client.from('deck_invites').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'deck.invite_deleted', resource_type: 'deck_invite', resource_id: id, severity: 'warning' });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
