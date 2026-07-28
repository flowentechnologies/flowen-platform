// DIDIT KYC verification webhook callback.
//
// DIDIT posts to this endpoint after a KYC session concludes. The payload is
// signed with HMAC-SHA256 using DIDIT_WEBHOOK_SECRET. The `vendor_data` field
// carries the Flowen user UUID, which was set when the KYC session was created
// (see /portal/verify-identity page — passes supabase user.id as vendor_data).
//
// Didit webhook payload reference:
//   https://docs.didit.me/identity-verification/webhooks
//
// Relevant status values:
//   Approved       — verification passed → set id_verified = true
//   Declined       — failed checks       → log, do not verify
//   In_Review      — manual review       → hold, no action
//   Resubmission   — resubmit requested  → hold, no action

import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

// ── Types ────────────────────────────────────────────────────────────────────

interface DiditWebhookPayload {
  session_id:  string;
  vendor_data: string;  // Flowen user UUID set during session creation
  status:      'Approved' | 'Declined' | 'In_Review' | 'Resubmission' | string;
  created_at:  string;
  document?:   Record<string, unknown>;
  face?:       Record<string, unknown>;
}

// ── Signature validation ──────────────────────────────────────────────────────

const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET ?? '';

/**
 * Verify the X-Didit-Signature header against the raw request body.
 * Didit signs with HMAC-SHA256; the header value is `sha256=<hex-digest>`.
 * Uses timingSafeEqual to prevent timing attacks.
 */
function verifyDiditSignature(rawBody: string, signatureHeader: string): boolean {
  if (!DIDIT_WEBHOOK_SECRET) {
    // Secret not configured — allow in development, block in production.
    if (process.env.NODE_ENV !== 'development') return false;
    console.warn('[didit-webhook] DIDIT_WEBHOOK_SECRET not set — skipping validation (dev only)');
    return true;
  }

  const expected = `sha256=${createHmac('sha256', DIDIT_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  // Pad shorter string to equal length before comparison to avoid length leaks.
  const sigBuf = Buffer.from(signatureHeader.padEnd(expected.length, '\0'));
  const expBuf = Buffer.from(expected.padEnd(signatureHeader.length, '\0'));

  try {
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

// ── Admin client ──────────────────────────────────────────────────────────────

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials not configured');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function markUserVerified(userId: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from('profiles')
    .update({ id_verified: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`profiles update failed: ${error.message}`);
}

async function logDeclinedAttempt(
  userId: string,
  payload: DiditWebhookPayload,
): Promise<void> {
  const admin = createAdminClient();

  await admin.from('system_error_logs').insert({
    source:      'webhook/didit/declined',
    error_code:  'KYC_DECLINED',
    message:     `KYC verification declined for user ${userId}`,
    metadata: {
      session_id:  payload.session_id,
      didit_status: payload.status,
      user_id:     userId,
    },
    environment: process.env.NODE_ENV ?? 'production',
    resolved:    false,
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

// Didit may send a GET to validate the webhook URL during configuration.
export function GET(): Response {
  return Response.json({ status: 'Flowen KYC webhook endpoint active' });
}

export async function POST(req: Request): Promise<Response> {
  const rawBody        = await req.text();
  const signatureHeader = req.headers.get('x-didit-signature') ?? '';

  // 1. Cryptographic signature check — reject any unsigned or tampered payloads.
  if (!verifyDiditSignature(rawBody, signatureHeader)) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  // 2. Parse payload.
  let payload: DiditWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DiditWebhookPayload;
  } catch {
    return Response.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const { vendor_data: userId, status, session_id } = payload;

  if (!userId || typeof userId !== 'string') {
    return Response.json(
      { error: 'Missing or invalid vendor_data — user UUID required' },
      { status: 400 },
    );
  }

  if (!session_id) {
    return Response.json({ error: 'Missing session_id' }, { status: 400 });
  }

  // 3. Dispatch by status.
  try {
    switch (status) {
      case 'Approved':
        await markUserVerified(userId);
        break;

      case 'Declined':
        await logDeclinedAttempt(userId, payload);
        break;

      case 'In_Review':
      case 'Resubmission':
        // Awaiting outcome — no action until a subsequent Approved/Declined event.
        break;

      default:
        // Unknown status — acknowledge but do not act.
        console.warn(`[didit-webhook] Unknown status "${status}" for session ${session_id}`);
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[didit-webhook] handler error:', msg);
    // Return 500 here so Didit retries — unlike Stripe, Didit expects a
    // successful 2xx only when the event was fully processed.
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ received: true });
}
