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

// SLA durations by priority
const SLA_HOURS: Record<string, number> = {
  urgent: 4,
  high:   8,
  normal: 24,
  low:    72,
};

function slaDate(priority: string): string {
  const hours = SLA_HOURS[priority] ?? 24;
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();
  const [ticketsRes, messagesRes] = await Promise.all([
    supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
    supabase.from('ticket_messages').select('id, ticket_id, from_admin, author, body, created_at').order('created_at', { ascending: true }),
  ]);

  const tickets  = ticketsRes.data  ?? [];
  const messages = messagesRes.data ?? [];

  // Group messages by ticket_id
  const msgMap: Record<string, typeof messages> = {};
  for (const m of messages) {
    if (!msgMap[m.ticket_id]) msgMap[m.ticket_id] = [];
    msgMap[m.ticket_id].push(m);
  }

  const enriched = tickets.map(t => ({ ...t, messages: msgMap[t.id] ?? [] }));
  return NextResponse.json({ tickets: enriched });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; [k: string]: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const supabase = db();
  const { action } = body;

  if (action === 'create_ticket') {
    const { subject, message, user_email, user_name, priority, category } = body as Record<string, string>;
    if (!subject || !message || !user_email) {
      return NextResponse.json({ error: 'subject, message, and user_email are required' }, { status: 400 });
    }
    const { data, error } = await supabase.from('support_tickets').insert({
      subject, body: message,
      user_email, user_name: user_name || null,
      priority: priority || 'normal',
      category: category || 'general',
      sla_due_at: slaDate(priority || 'normal'),
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ...data, messages: [] } });
  }

  if (action === 'update_ticket') {
    const { id, status, priority, category, assigned_to, internal_notes } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status)         updates.status         = status;
    if (priority)       { updates.priority = priority; updates.sla_due_at = slaDate(priority); }
    if (category)       updates.category       = category;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (internal_notes !== undefined) updates.internal_notes = internal_notes || null;
    if (status === 'resolved' || status === 'closed') updates.resolved_at = new Date().toISOString();

    const { error } = await supabase.from('support_tickets').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'add_message') {
    const { ticket_id, body: msgBody, from_admin, author } = body as Record<string, unknown>;
    if (!ticket_id || !msgBody) return NextResponse.json({ error: 'ticket_id and body required' }, { status: 400 });

    const isAdmin = from_admin === true || from_admin === 'true';
    const [msgRes] = await Promise.all([
      supabase.from('ticket_messages').insert({
        ticket_id, body: msgBody,
        from_admin: isAdmin,
        author: author || (isAdmin ? 'Support Team' : 'User'),
      }).select().single(),
      // Mark first response time if this is the first admin reply
      isAdmin
        ? supabase.from('support_tickets')
            .update({ first_response_at: new Date().toISOString(), status: 'in_progress', updated_at: new Date().toISOString() })
            .eq('id', ticket_id)
            .is('first_response_at', null)
        : Promise.resolve(),
    ]);

    if (msgRes.error) return NextResponse.json({ error: msgRes.error.message }, { status: 500 });
    return NextResponse.json({ data: msgRes.data });
  }

  if (action === 'delete_ticket') {
    const { id } = body as Record<string, string>;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('support_tickets').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
