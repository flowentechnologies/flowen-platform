import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/guard';
import { logAuditEvent } from '@/lib/admin/audit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rollout_pct: number;
  allowed_tiers: string[] | null;
  created_at: string;
  updated_at: string;
}

// ── DB client ─────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await db()
    .from('feature_flags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ flags: (data ?? []) as FeatureFlag[] });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: Record<string, unknown> = await request.json();
  const action = body.action as string | undefined;

  if (action === 'create') {
    const key = body.key as string | undefined;
    const name = body.name as string | undefined;
    if (!key || !name) {
      return NextResponse.json({ error: 'key and name are required' }, { status: 400 });
    }

    const insert: Record<string, unknown> = {
      key,
      name,
      description: (body.description as string | undefined) ?? null,
      rollout_pct: (body.rollout_pct as number | undefined) ?? 100,
      allowed_tiers: (body.allowed_tiers as string[] | undefined) ?? null,
    };

    const { data, error } = await db()
      .from('feature_flags')
      .insert(insert)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    void logAuditEvent({
      actor_id: admin.id,
      actor_email: admin.email,
      action: 'feature_flag.create',
      resource_type: 'feature_flag',
      resource_id: (data as FeatureFlag).id,
      metadata: { key, name },
    });

    return NextResponse.json({ flag: data as FeatureFlag });
  }

  if (action === 'update') {
    const id = body.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.rollout_pct !== undefined) updates.rollout_pct = body.rollout_pct;
    if (body.allowed_tiers !== undefined) updates.allowed_tiers = body.allowed_tiers;

    const { data, error } = await db()
      .from('feature_flags')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    void logAuditEvent({
      actor_id: admin.id,
      actor_email: admin.email,
      action: 'feature_flag.update',
      resource_type: 'feature_flag',
      resource_id: id,
      metadata: updates,
    });

    return NextResponse.json({ flag: data as FeatureFlag });
  }

  if (action === 'toggle') {
    const id = body.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Fetch current state then flip
    const { data: current, error: fetchError } = await db()
      .from('feature_flags')
      .select('enabled')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json({ error: fetchError?.message ?? 'Not found' }, { status: 400 });
    }

    const { data, error } = await db()
      .from('feature_flags')
      .update({ enabled: !(current as { enabled: boolean }).enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    void logAuditEvent({
      actor_id: admin.id,
      actor_email: admin.email,
      action: 'feature_flag.toggle',
      resource_type: 'feature_flag',
      resource_id: id,
      metadata: { enabled: (data as FeatureFlag).enabled },
    });

    return NextResponse.json({ flag: data as FeatureFlag });
  }

  if (action === 'delete') {
    const id = body.id as string | undefined;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await db()
      .from('feature_flags')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    void logAuditEvent({
      actor_id: admin.id,
      actor_email: admin.email,
      action: 'feature_flag.delete',
      resource_type: 'feature_flag',
      resource_id: id,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
