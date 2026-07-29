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

// ── GET — fetch all campaign data ─────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();
  const [milestonesRes, contactsRes, pressRes] = await Promise.all([
    supabase.from('campaign_milestones').select('*').order('target_date', { ascending: true }),
    supabase.from('campaign_contacts').select('*').order('created_at', { ascending: false }),
    supabase.from('campaign_press_links').select('*').order('published_date', { ascending: false }),
  ]);

  return NextResponse.json({
    milestones: milestonesRes.data ?? [],
    contacts:   contactsRes.data   ?? [],
    press:      pressRes.data       ?? [],
  });
}

// ── POST — create / update / delete ──────────────────────────────────────────

type Action =
  | 'create_contact'
  | 'update_contact_status'
  | 'delete_contact'
  | 'create_milestone'
  | 'update_milestone_status'
  | 'delete_milestone'
  | 'create_press'
  | 'delete_press';

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: Action; [key: string]: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const supabase = db();
  const { action } = body;

  // ── Contacts ────────────────────────────────────────────────────────────────

  if (action === 'create_contact') {
    const { name, type, organisation, constituency, platform, followers_count, email, notes, status } = body as Record<string, string>;
    if (!name || !type) return NextResponse.json({ error: 'name and type required' }, { status: 400 });
    const { data, error } = await supabase.from('campaign_contacts').insert({
      name, type, organisation: organisation || null, constituency: constituency || null,
      platform: platform || null, followers_count: followers_count ? parseInt(followers_count) : null,
      email: email || null, notes: notes || null, status: status || 'identified',
      contacted_at: status && status !== 'identified' ? new Date().toISOString() : null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'update_contact_status') {
    const { id, status } = body as Record<string, string>;
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status !== 'identified') updates.contacted_at = new Date().toISOString();
    if (status === 'responded' || status === 'meeting_booked' || status === 'supporting' || status === 'declined') {
      updates.responded_at = new Date().toISOString();
    }
    const { error } = await supabase.from('campaign_contacts').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_contact') {
    const { id } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('campaign_contacts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Milestones ──────────────────────────────────────────────────────────────

  if (action === 'create_milestone') {
    const { title, description, category, target_date, status } = body as Record<string, string>;
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const { data, error } = await supabase.from('campaign_milestones').insert({
      title, description: description || null, category: category || 'general',
      target_date: target_date || null, status: status || 'upcoming',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'update_milestone_status') {
    const { id, status } = body as Record<string, string>;
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'achieved') updates.achieved_date = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('campaign_milestones').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_milestone') {
    const { id } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('campaign_milestones').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Press links ─────────────────────────────────────────────────────────────

  if (action === 'create_press') {
    const { title, publication, url, published_date, sentiment } = body as Record<string, string>;
    if (!title || !publication) return NextResponse.json({ error: 'title and publication required' }, { status: 400 });
    const { data, error } = await supabase.from('campaign_press_links').insert({
      title, publication, url: url || null,
      published_date: published_date || null, sentiment: sentiment || 'neutral',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === 'delete_press') {
    const { id } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('campaign_press_links').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
