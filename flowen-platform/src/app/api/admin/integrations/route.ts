import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createHash, randomBytes } from 'crypto';
import { adminDb as db } from '@/lib/supabase/admin';

// ── DB client ─────────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const raw       = randomBytes(32).toString('hex');
  const plaintext = `fwn_${raw}`;
  const prefix    = plaintext.slice(0, 8);
  const hash      = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, prefix, hash };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('api_keys')
    .select('id,name,key_prefix,scopes,expires_at,revoked,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ keys: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; name?: string; scopes?: string[]; expires_at?: string | null; id?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  // ── create_api_key ──────────────────────────────────────────────────────
  if (action === 'create_api_key') {
    const { name, scopes, expires_at } = body;
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!scopes?.length) return NextResponse.json({ error: 'scopes required' }, { status: 400 });

    const { plaintext, prefix, hash } = generateApiKey();

    const { data, error } = await db()
      .from('api_keys')
      .insert({
        name:       name.trim(),
        key_prefix: prefix,
        key_hash:   hash,
        scopes,
        expires_at: expires_at ?? null,
      })
      .select('id,name,key_prefix,scopes,expires_at,created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data: {
        id:          (data as { id: string }).id,
        name:        (data as { name: string }).name,
        key_prefix:  (data as { key_prefix: string }).key_prefix,
        scopes:      (data as { scopes: string[] }).scopes,
        expires_at:  (data as { expires_at: string | null }).expires_at,
        created_at:  (data as { created_at: string }).created_at,
        plaintext,
      },
    });
  }

  // ── revoke_key ──────────────────────────────────────────────────────────
  if (action === 'revoke_key') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await db()
      .from('api_keys')
      .update({ revoked: true })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── delete_key ──────────────────────────────────────────────────────────
  if (action === 'delete_key') {
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await db()
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
