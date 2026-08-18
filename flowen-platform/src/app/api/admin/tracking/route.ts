import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { generateScripts, type ProviderKey } from '@/lib/tracking-scripts';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('tracking_providers')
    .select('*')
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    provider_key: string;
    enabled?: boolean;
    pixel_id?: string;
    head_html?: string | null;
    body_html?: string | null;
    server_config?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider_key, enabled, pixel_id, head_html, body_html, server_config } = body;
  if (!provider_key) return NextResponse.json({ error: 'provider_key required' }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (enabled !== undefined) update.enabled = enabled;
  if (server_config !== undefined) update.server_config = server_config;

  if (pixel_id !== undefined) {
    update.pixel_id = pixel_id;
    if (provider_key !== 'custom' && pixel_id) {
      const scripts = generateScripts(provider_key as ProviderKey, pixel_id);
      update.head_html = scripts.head_html;
      update.body_html = scripts.body_html;
    }
  }

  if (provider_key === 'custom') {
    if (head_html !== undefined) update.head_html = head_html;
    if (body_html !== undefined) update.body_html = body_html;
  }

  const { data, error } = await db()
    .from('tracking_providers')
    .update(update)
    .eq('provider_key', provider_key)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
