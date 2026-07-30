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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await db()
    .from('gdpr_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; [k: string]: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const supabase = db();
  const { action } = body;

  if (action === 'create_request') {
    const { user_email, user_name, user_id, request_type, details } = body as Record<string, string>;
    if (!user_email || !request_type) {
      return NextResponse.json({ error: 'user_email and request_type are required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('gdpr_requests').insert({
      user_email, user_name: user_name || null,
      user_id:    user_id    || null,
      request_type, details: details || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'update_status') {
    const { id, status, internal_notes } = body as Record<string, string>;
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'acknowledged')  updates.acknowledged_at = new Date().toISOString();
    if (status === 'completed')     updates.completed_at    = new Date().toISOString();
    if (internal_notes !== undefined) updates.internal_notes = internal_notes || null;
    const { error } = await supabase.from('gdpr_requests').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'apply_erasure') {
    const { id } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Fetch user_id from the DB row — never trust client-supplied user_id
    const { data: gdprRow, error: fetchError } = await supabase
      .from('gdpr_requests')
      .select('user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !gdprRow) {
      return NextResponse.json({ error: 'GDPR request not found' }, { status: 404 });
    }
    if (!gdprRow.user_id) {
      return NextResponse.json({ error: 'No user_id on this request — cannot erase' }, { status: 400 });
    }

    // Idempotency: refuse if already completed
    if (gdprRow.status === 'completed') {
      return NextResponse.json({ error: 'Erasure already completed for this request' }, { status: 409 });
    }

    const userId = gdprRow.user_id as string;

    // Mark in-progress first to prevent concurrent double-erasure
    await supabase.from('gdpr_requests').update({
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('status', gdprRow.status);

    const { error: rpcError } = await supabase.rpc('apply_gdpr_erasure', { target_user_id: userId });
    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    const { error } = await supabase.from('gdpr_requests').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      internal_notes: 'Erasure applied via apply_gdpr_erasure() + auth.users deleted.',
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  }

  if (action === 'delete_request') {
    const { id } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('gdpr_requests').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
