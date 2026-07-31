import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';

// ── Exported types ─────────────────────────────────────────────────────────────

export type IPAssetType =
  | 'ai_model'
  | 'trademark'
  | 'patent'
  | 'trade_secret'
  | 'copyright'
  | 'domain'
  | 'dataset';

export interface IPAsset {
  id: string;
  asset_type: IPAssetType;
  name: string;
  description: string | null;
  jurisdiction: string | null;
  status: string;
  filing_date: string | null;
  registration_number: string | null;
  renewal_date: string | null;
  estimated_value_pence: number | null;
  owner: string;
  notes: string | null;
  created_at: string;
}

export interface ModelVersion {
  id: string;
  model_name: string;
  version: string;
  description: string | null;
  training_clips: number | null;
  accuracy_pct: number | null;
  latency_ms: number | null;
  deployed: boolean;
  deployed_at: string | null;
  deprecated: boolean;
  created_at: string;
}

// ── DB client ─────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();

  const [assetsRes, versionsRes] = await Promise.all([
    supabase.from('ip_assets').select('*').order('created_at', { ascending: false }),
    supabase.from('ip_model_versions').select('*').order('created_at', { ascending: false }),
  ]);

  // Graceful empty if tables missing
  const assets: IPAsset[] = assetsRes.data ?? [];
  const modelVersions: ModelVersion[] = versionsRes.data ?? [];

  return NextResponse.json({ assets, modelVersions });
}

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; [key: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;
  const supabase = db();

  // ── IP Assets ───────────────────────────────────────────────────────────────

  if (action === 'add_asset') {
    const {
      asset_type,
      name,
      description,
      jurisdiction,
      status,
      filing_date,
      registration_number,
      renewal_date,
      estimated_value_pence,
      owner,
      notes,
    } = body as Record<string, unknown>;

    if (!asset_type || !name) {
      return NextResponse.json({ error: 'asset_type and name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('ip_assets')
      .insert({
        asset_type,
        name,
        description: description ?? null,
        jurisdiction: jurisdiction ?? null,
        status: status ?? 'unregistered',
        filing_date: filing_date || null,
        registration_number: registration_number ?? null,
        renewal_date: renewal_date || null,
        estimated_value_pence: estimated_value_pence ?? null,
        owner: owner ?? 'Flowen Technologies Ltd',
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'update_asset') {
    const { id, ...fields } = body as unknown as { id: string; [key: string]: unknown };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const allowed = [
      'asset_type', 'name', 'description', 'jurisdiction', 'status',
      'filing_date', 'registration_number', 'renewal_date',
      'estimated_value_pence', 'owner', 'notes',
    ];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in fields) {
        update[k] = fields[k] === '' ? null : fields[k];
      }
    }
    // Normalise empty date strings to null
    for (const dateField of ['filing_date', 'renewal_date']) {
      if (dateField in update && !update[dateField]) update[dateField] = null;
    }

    const { data, error } = await supabase
      .from('ip_assets')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'delete_asset') {
    const { id } = body as unknown as { id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabase.from('ip_assets').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Model Versions ──────────────────────────────────────────────────────────

  if (action === 'add_version') {
    const {
      model_name,
      version,
      description,
      training_clips,
      accuracy_pct,
      latency_ms,
      deployed,
      deployed_at,
      deprecated,
    } = body as Record<string, unknown>;

    if (!version) return NextResponse.json({ error: 'version is required' }, { status: 400 });

    // If this is deployed, unset deployed on all other versions first
    if (deployed) {
      await supabase
        .from('ip_model_versions')
        .update({ deployed: false, deployed_at: null })
        .eq('deployed', true);
    }

    const { data, error } = await supabase
      .from('ip_model_versions')
      .insert({
        model_name: model_name ?? 'Disfluent ASR Engine',
        version,
        description: description ?? null,
        training_clips: training_clips ?? null,
        accuracy_pct: accuracy_pct ?? null,
        latency_ms: latency_ms ?? null,
        deployed: deployed ?? false,
        deployed_at: deployed ? (deployed_at ?? new Date().toISOString()) : null,
        deprecated: deprecated ?? false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'update_version') {
    const { id, ...fields } = body as unknown as { id: string; [key: string]: unknown };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const allowed = [
      'model_name', 'version', 'description', 'training_clips',
      'accuracy_pct', 'latency_ms', 'deployed', 'deployed_at', 'deprecated',
    ];
    const update: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in fields) update[k] = fields[k];
    }

    // If setting deployed=true, unset all others first
    if (update.deployed === true) {
      await supabase
        .from('ip_model_versions')
        .update({ deployed: false, deployed_at: null })
        .eq('deployed', true)
        .neq('id', id);
    }
    if (!update.deployed) update.deployed_at = null;

    const { data, error } = await supabase
      .from('ip_model_versions')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'delete_version') {
    const { id } = body as unknown as { id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabase.from('ip_model_versions').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
