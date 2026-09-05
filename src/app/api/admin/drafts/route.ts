/**
 * /api/admin/drafts
 *
 * GET    — list AI-drafted replies/outreach (default: status=pending).
 * PATCH  — the ONLY route in this codebase that can turn a draft into an
 *          actually-sent email. Requires an explicit admin action per
 *          draft: {id, action: 'approve' | 'reject', body?, subject?}.
 *          'approve' calls Gmail's send API via sendAs() — there is no
 *          confidence threshold that skips this, ever, per instruction:
 *          every response and outreach goes through manual approval here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { adminDb as db } from '@/lib/supabase/admin';
import { sendAs } from '@/lib/gmail';
import { logAuditEvent } from '@/lib/admin/audit';

export async function GET(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const status = new URL(req.url).searchParams.get('status') ?? 'pending';
  const supabase = db();
  let query = supabase
    .from('ai_drafts')
    .select('*, inbox_items(subject, from_address, from_name, alias, category)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data, admin: admin.email });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let admin;
  try { admin = await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const body = await req.json() as {
    id?: string;
    action?: 'approve' | 'reject';
    subject?: string;   // optional edit before sending
    body_text?: string; // optional edit before sending
  };
  if (!body.id || !body.action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
  }

  const supabase = db();
  const { data: draft, error: fetchErr } = await supabase
    .from('ai_drafts').select('*, inbox_items(gmail_message_id, gmail_thread_id)').eq('id', body.id).single();
  if (fetchErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  if (draft.status !== 'pending') {
    return NextResponse.json({ error: `Draft already ${draft.status}` }, { status: 409 });
  }

  if (body.action === 'reject') {
    await supabase.from('ai_drafts').update({
      status: 'rejected', reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
    }).eq('id', body.id);
    await logAuditEvent({ action: 'inbox.draft_rejected', actor_id: admin.id, metadata: { draft_id: body.id } });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // action === 'approve' — the actual send.
  const wasEdited = (body.subject && body.subject !== draft.subject) || (body.body_text && body.body_text !== draft.body_text);
  const subject = body.subject ?? draft.subject;
  const bodyText = body.body_text ?? draft.body_text;
  const inboxItem = draft.inbox_items as { gmail_message_id: string; gmail_thread_id: string } | null;

  try {
    const sent = await sendAs({
      fromAlias: draft.from_alias,
      to: draft.to_address,
      subject,
      body: bodyText,
      threadId: inboxItem?.gmail_thread_id,
      inReplyToMessageId: draft.draft_type === 'reply' ? inboxItem?.gmail_message_id : undefined,
    });

    await supabase.from('ai_drafts').update({
      status: wasEdited ? 'edited_sent' : 'sent',
      subject, body_text: bodyText,
      reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
      gmail_message_id: sent.id,
    }).eq('id', body.id);

    if (draft.inbox_item_id) {
      await supabase.from('inbox_items').update({ status: 'responded' }).eq('id', draft.inbox_item_id);
    }

    if (draft.crm_contact_id) {
      await supabase.from('crm_activities').insert({
        crm_contact_id: draft.crm_contact_id,
        type: 'email_outbound',
        body: subject,
        created_by: admin.id,
      });
      await supabase.from('crm_contacts').update({ last_contact_at: new Date().toISOString() }).eq('id', draft.crm_contact_id);
    }

    await logAuditEvent({
      action: 'inbox.draft_sent', actor_id: admin.id,
      metadata: { draft_id: body.id, to: draft.to_address, from_alias: draft.from_alias, edited: wasEdited },
    });

    return NextResponse.json({ ok: true, status: 'sent', gmail_message_id: sent.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 });
  }
}
