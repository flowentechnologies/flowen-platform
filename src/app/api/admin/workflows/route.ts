import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { createClient } from '@supabase/supabase-js';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; [key: string]: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;
  const supabase = db();

  // ── toggle_status ───────────────────────────────────────────────────────────
  if (action === 'toggle_status') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: wf } = await supabase
      .from('workflow_definitions')
      .select('status')
      .eq('id', id)
      .single();

    if (!wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const next = wf.status === 'active' ? 'paused' : 'active';
    const { data, error } = await supabase
      .from('workflow_definitions')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ── trigger_workflow ────────────────────────────────────────────────────────
  if (action === 'trigger_workflow') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data: wf } = await supabase
      .from('workflow_definitions')
      .select('id')
      .eq('id', id)
      .single();

    if (!wf) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });

    const now = new Date().toISOString();
    const durationMs = Math.floor(Math.random() * 800) + 200;
    const finishedAt = new Date(Date.now() + durationMs).toISOString();

    const { data: run, error: runError } = await supabase
      .from('workflow_runs')
      .insert({
        workflow_id: id,
        status: 'success',
        triggered_by: 'manual',
        context: { triggered_by_admin: admin.email },
        result: { message: 'Simulated execution completed' },
        duration_ms: durationMs,
        started_at: now,
        finished_at: finishedAt,
      })
      .select()
      .single();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

    // Atomic increment avoids TOCTOU race under concurrent triggers
    await supabase.rpc('increment_workflow_run_count', { wf_id: id, ran_at: now });

    return NextResponse.json({ data: run });
  }

  // ── create_workflow ─────────────────────────────────────────────────────────
  if (action === 'create_workflow') {
    const { name, description, trigger_type, status } = body as {
      action: string;
      name: string;
      description: string;
      trigger_type: string;
      status: string;
    };

    if (!name || !trigger_type) {
      return NextResponse.json({ error: 'name and trigger_type are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('workflow_definitions')
      .insert({
        name,
        description: description || null,
        trigger_type,
        trigger_config: {},
        steps: [],
        status: status || 'draft',
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ── delete_workflow ─────────────────────────────────────────────────────────
  if (action === 'delete_workflow') {
    const { id } = body as { action: string; id: string };
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await supabase.from('workflow_definitions').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
