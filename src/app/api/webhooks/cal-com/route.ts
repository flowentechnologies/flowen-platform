/**
 * POST /api/webhooks/cal-com
 *
 * Receives Cal.com booking webhooks. Handles BOOKING_CREATED: links (or
 * creates) a CRM contact by the attendee's email and raises an admin
 * notification — the same "external event -> CRM + bell" pattern already
 * used for Explee and Gmail. Every event type is logged to cal_bookings
 * for a raw audit trail; only BOOKING_CREATED gets the CRM/notification
 * side effects for now (cancellations/reschedules just update the row).
 *
 * Required env vars:
 *   CAL_COM_WEBHOOK_SECRET — the secret set when registering this webhook
 *                            at Cal.com (Settings → Developer → Webhooks)
 *
 * Register at: https://app.cal.com/settings/developer/webhooks
 *   Subscriber URL: https://www.flowen.digital/api/webhooks/cal-com
 *   Event triggers: Booking Created (add more as this route grows to handle them)
 *
 * Signature: HMAC-SHA256 of the raw request body, hex-encoded, in the
 * x-cal-signature-256 header — confirmed against Cal.com's own docs.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb as db } from '@/lib/supabase/admin';

function verifySignature(secret: string, rawBody: string, sig: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

interface CalWebhookPayload {
  triggerEvent: string;
  createdAt: string;
  payload: {
    title?: string;
    startTime?: string;
    endTime?: string;
    uid: string;
    status?: string;
    organizer?: { email?: string; name?: string };
    attendees?: { email: string; name?: string }[];
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  const secret = process.env.CAL_COM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[cal-com-webhook] CAL_COM_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }
  const sig = req.headers.get('x-cal-signature-256') ?? '';
  if (!verifySignature(secret, rawBody, sig)) {
    console.warn('[cal-com-webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: CalWebhookPayload;
  try {
    event = JSON.parse(rawBody) as CalWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { triggerEvent, payload } = event;
  const uid = payload?.uid;
  if (!uid) return NextResponse.json({ skipped: true, reason: 'missing booking uid' });

  const supabase = db();
  const attendee = payload.attendees?.[0];

  // Idempotency — a retried delivery for a booking we've already recorded
  // just no-ops rather than creating a second CRM contact or notification.
  const { data: existing } = await supabase.from('cal_bookings').select('id').eq('uid', uid).maybeSingle();
  if (existing) return NextResponse.json({ skipped: true, reason: 'already processed', uid });

  let crmContactId: string | null = null;

  if (triggerEvent === 'BOOKING_CREATED' && attendee?.email) {
    const { data: existingContact } = await supabase
      .from('crm_contacts').select('id').eq('email', attendee.email).maybeSingle();

    if (existingContact) {
      crmContactId = existingContact.id as string;
      await supabase.from('crm_activities').insert({
        crm_contact_id: crmContactId, type: 'meeting',
        body: `Booked "${payload.title ?? 'a call'}" via Cal.com for ${payload.startTime ?? 'an upcoming time'}`,
      });
    } else {
      const { data: created, error } = await supabase.from('crm_contacts').insert({
        email: attendee.email, name: attendee.name ?? null,
        category: 'other', stage: 'contacted', source: 'cal_com',
        last_contact_at: new Date().toISOString(),
        notes: `First contact via Cal.com booking: "${payload.title ?? 'a call'}"`,
      }).select('id').single();
      if (!error && created) crmContactId = created.id as string;
    }

    await supabase.from('admin_notifications').insert({
      type: 'booking_new',
      title: `📅 New booking: ${attendee.name ?? attendee.email}`,
      body: `${payload.title ?? 'Call'} — ${payload.startTime ? new Date(payload.startTime).toLocaleString('en-GB') : 'time TBC'}`,
      link: crmContactId ? `/admin/crm?contact=${crmContactId}` : '/admin/crm',
      priority: 'high',
    });
  }

  await supabase.from('cal_bookings').insert({
    uid, trigger_event: triggerEvent,
    event_type_title: payload.title ?? null,
    organizer_email: payload.organizer?.email ?? null,
    attendee_email: attendee?.email ?? null,
    attendee_name: attendee?.name ?? null,
    start_time: payload.startTime ?? null,
    end_time: payload.endTime ?? null,
    status: payload.status ?? null,
    crm_contact_id: crmContactId,
    raw_payload: payload,
  });

  return NextResponse.json({ ok: true, uid, triggerEvent, crmContactId });
}
