import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/guard';
import { stripe } from '@/lib/stripe';
import { logAuditEvent } from '@/lib/admin/audit';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { action: string; subscriptionId?: string; chargeId?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  if (action === 'cancel_subscription') {
    if (!body.subscriptionId) return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 });
    try {
      const sub = await stripe.subscriptions.update(body.subscriptionId, {
        cancel_at_period_end: true,
      });
      void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'billing.subscription_cancelled', resource_type: 'subscription', resource_id: body.subscriptionId, metadata: { subscription_id: body.subscriptionId, immediate: false }, severity: 'warning' });
      return NextResponse.json({ success: true, cancel_at_period_end: sub.cancel_at_period_end });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (action === 'cancel_immediately') {
    if (!body.subscriptionId) return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 });
    try {
      await stripe.subscriptions.cancel(body.subscriptionId);
      void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'billing.subscription_cancelled', resource_type: 'subscription', resource_id: body.subscriptionId, metadata: { subscription_id: body.subscriptionId, immediate: true }, severity: 'warning' });
      return NextResponse.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (action === 'issue_refund') {
    if (!body.chargeId) return NextResponse.json({ error: 'chargeId required' }, { status: 400 });
    try {
      const refundParams: { charge: string; amount?: number } = { charge: body.chargeId };
      if (body.amount) refundParams.amount = body.amount;
      const refund = await stripe.refunds.create(refundParams);
      void logAuditEvent({ actor_email: admin.email, actor_id: admin.id, action: 'billing.refund', resource_type: 'refund', resource_id: refund.id, metadata: { amount_pence: body.amount ?? null, charge_id: body.chargeId }, severity: 'critical' });
      return NextResponse.json({ success: true, refundId: refund.id, status: refund.status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stripe error';
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
