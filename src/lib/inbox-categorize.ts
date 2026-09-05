// ── Inbox categorisation ──────────────────────────────────────────────────────
// Pure functions, no I/O — kept separate from the sync worker so the rules
// are easy to read and extend without wading through Gmail API plumbing.

const VENDOR_DOMAINS: Record<string, string> = {
  'vercel.com':       'Vercel',
  'supabase.com':     'Supabase',
  'supabase.io':      'Supabase',
  'stripe.com':       'Stripe',
  'anthropic.com':    'Anthropic',
  'openai.com':       'OpenAI',
  'deepgram.com':     'Deepgram',
  'sentry.io':        'Sentry',
  'upstash.com':      'Upstash',
  'upstash.io':       'Upstash',
  'posthog.com':      'PostHog',
  'resend.com':       'Resend',
  'google.com':       'Google Workspace',
  'workspace.google.com': 'Google Workspace',
  'github.com':       'GitHub',
  'cloudflare.com':   'Cloudflare',
  'namecheap.com':    'Namecheap',
  'godaddy.com':      'GoDaddy',
  'digitalocean.com': 'DigitalOcean',
  'twilio.com':       'Twilio',
  'elevenlabs.io':    'ElevenLabs',
  'agora.io':         'Agora',
  'meta.com':         'Meta',
  'facebookmail.com': 'Meta',
};

const BILLING_KEYWORDS = [
  'invoice', 'receipt', 'payment', 'billing', 'subscription renewed',
  'your bill', 'statement', 'payment failed', 'auto-renew', 'renewal',
];

const NHS_DOMAIN_HINT = /\.nhs\.uk$/i;

const ALIAS_CATEGORY_MAP: Record<string, string> = {
  security:   'security',
  press:      'press',
  support:    'support',
  clinical:   'support',
  careers:    'careers',
  affiliates: 'affiliates',
  investors:  'crm',
};

export interface Categorization {
  category: 'general' | 'billing' | 'crm' | 'press' | 'security' | 'support' | 'careers' | 'affiliates' | 'other';
  isBilling: boolean;
  vendorName: string | null;
  crmCategory: 'investor' | 'grant' | 'nhs_partner' | 'press' | 'affiliate' | 'vendor' | 'other' | null;
}

export function categorize(opts: {
  alias: string;
  fromAddress: string;
  subject: string;
  snippet: string;
}): Categorization {
  const domain = opts.fromAddress.split('@')[1]?.toLowerCase() ?? '';
  const text = `${(opts.subject ?? '').toLowerCase()} ${(opts.snippet ?? '').toLowerCase()}`;

  const vendorName = VENDOR_DOMAINS[domain] ?? null;
  const looksLikeBilling = BILLING_KEYWORDS.some(k => text.includes(k));
  const isBilling = opts.alias === 'billing' || (!!vendorName && looksLikeBilling);

  if (isBilling) {
    return { category: 'billing', isBilling: true, vendorName, crmCategory: vendorName ? 'vendor' : null };
  }

  const category = (ALIAS_CATEGORY_MAP[opts.alias] as Categorization['category']) ?? 'general';

  let crmCategory: Categorization['crmCategory'] = null;
  if (opts.alias === 'investors') crmCategory = 'investor';
  else if (opts.alias === 'affiliates') crmCategory = 'affiliate';
  else if (opts.alias === 'press') crmCategory = 'press';
  else if (NHS_DOMAIN_HINT.test(domain)) crmCategory = 'nhs_partner';

  return { category, isBilling: false, vendorName, crmCategory };
}

/** Best-effort amount extraction from a billing email's subject/snippet —
 *  e.g. "Your receipt for £24.00" or "$50.00 payment received". Returns
 *  null (not zero) when nothing parses, so the admin UI can show "amount
 *  unknown" rather than a misleading £0.00. */
export function extractAmountPence(text: string): { amountPence: number; currency: string } | null {
  const match = text.match(/([£$€])\s?(\d+(?:[.,]\d{2})?)/);
  if (!match) return null;
  const currency = { '£': 'gbp', '$': 'usd', '€': 'eur' }[match[1]] ?? 'gbp';
  const amount = parseFloat(match[2].replace(',', '.'));
  return { amountPence: Math.round(amount * 100), currency };
}
