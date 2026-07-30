import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

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

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
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
    return NextResponse.json({ invite: data });
  }

  if (action === 'revoke') {
    const { id } = body;
    const { error } = await client.from('deck_invites').update({ revoked: true }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'delete') {
    const { id } = body;
    await client.from('deck_views').delete().eq('invite_id', id);
    const { error } = await client.from('deck_invites').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
