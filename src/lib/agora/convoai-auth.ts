/**
 * Builds the Basic-auth header ConvoAI REST calls need
 * (Authorization: Basic base64(customerId:customerSecret)).
 *
 * Previously defined locally inside src/app/api/agora/convoai/route.ts only;
 * pulled out so system-health's Agora check and the agora-agent-sweep cron
 * can authenticate the same way without re-deriving the header by hand a
 * second and third time.
 */

export function getConvoAIHeaders(): HeadersInit {
  const customerId = process.env.AGORA_CUSTOMER_ID;
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET;
  if (!customerId || !customerSecret) throw new Error('Agora ConvoAI credentials not configured');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`,
  };
}
