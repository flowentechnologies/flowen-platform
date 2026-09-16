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

// A billing-categorised email reporting a payment that did NOT go through
// (a declined card, a failed charge retry, a suspended service) rather
// than a real invoice for money actually spent. Found via a real data
// bug: "payment" alone in BILLING_KEYWORDS matched failure notices just as
// readily as genuine receipts, and 8 declined-payment emails (a $5.98 x3
// Explee retry sequence, plus 5 Google Ads/Workspace declined-card and
// service-suspension notices — all real, all tracing back to the same
// declined-card issue system-health's explee-credits check has been
// flagging) had landed in vendor_invoices as if they were real bills, and
// the connected Xero bookkeeping agent had already started proposing real
// expense drafts for them before this fix landed.
const PAYMENT_FAILURE_KEYWORDS = [
  'unsuccessful', 'failed', 'declined', 'could not be charged', 'unable to charge',
  "weren't able to charge", "wasn't able to charge", 'past due', 'overdue',
  'suspended', 'update your payment',
];

const NHS_DOMAIN_HINT = /\.nhs\.uk$/i;

// 'grant' was a valid crmCategory with no code path that ever assigned it —
// nothing auto-detected grant-related correspondence (SBRI, Innovate UK,
// funding bodies) at all until this.
const GRANT_KEYWORDS = [
  'grant', 'sbri', 'innovate uk', 'innovateuk', 'funding award', 'funding call',
  'competition brief', 'phase 1 application', 'phase 2 application', 'nihr',
];
const GRANT_DOMAIN_HINT = /\.(gov\.uk|innovateuk\.gov\.uk|iuk\.ktn-uk\.org|ukri\.org)$/i;

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
  else if (GRANT_DOMAIN_HINT.test(domain) || GRANT_KEYWORDS.some(k => text.includes(k))) crmCategory = 'grant';

  return { category, isBilling: false, vendorName, crmCategory };
}

/** True when a billing-categorised email is reporting a payment failure
 *  rather than a completed charge — see PAYMENT_FAILURE_KEYWORDS above.
 *  gmail-sync checks this before inserting a vendor_invoices row: a
 *  failure notice still gets categorised as billing (so it's visible and
 *  notified on — a declined card is genuinely worth an admin's attention,
 *  arguably more urgently than a routine receipt) but must never become a
 *  vendor_invoices row, because no money actually moved. */
export function isPaymentFailureNotice(text: string): boolean {
  const lower = text.toLowerCase();
  return PAYMENT_FAILURE_KEYWORDS.some(k => lower.includes(k));
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

export type NotificationPriority = 'high' | 'normal' | 'low';

/** Differentiates urgency so a security report and a promotions-tab email
 *  don't look identical in the notification bell. Security and billing
 *  (money) mail is always high regardless of Gmail's own tab; an investor/
 *  NHS-partner CRM contact is high (a fundraising or NHS lead is
 *  time-sensitive); anything Gmail itself filed as Social/Promotions is
 *  low even if it landed in a business-relevant category; everything else
 *  is normal. */
export function computeNotificationPriority(opts: {
  category: Categorization['category'];
  crmCategory?: Categorization['crmCategory'] | null;
  gmailCategory?: string | null;
}): NotificationPriority {
  if (opts.category === 'security' || opts.category === 'billing') return 'high';
  if (opts.crmCategory === 'investor' || opts.crmCategory === 'nhs_partner') return 'high';
  if (opts.gmailCategory === 'social' || opts.gmailCategory === 'promotions') return 'low';
  return 'normal';
}

const AUTOMATED_SENDER_LOCAL_PARTS = [
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'mailer-daemon',
  'notifications', 'system', 'postmaster',
];

/** True for mail that structurally can't/shouldn't get a drafted reply:
 *  bounce notifications, "confirm this alias" system mail, and bulk
 *  marketing/updates Gmail itself already tagged as such. Found by
 *  actually trying the feature — the AI correctly recognised these as
 *  "no reply needed" and said so in the draft body, but that judgement
 *  call still landed in the same send-approval queue as a real draft,
 *  which is the wrong place for it. Skipping generation entirely (rather
 *  than trusting the model to self-report) means the drafts queue only
 *  ever contains things actually worth an admin's attention. */
export function isAutomatedMail(opts: { fromAddress: string; gmailCategory?: string | null }): boolean {
  const localPart = opts.fromAddress.split('@')[0]?.toLowerCase() ?? '';
  if (AUTOMATED_SENDER_LOCAL_PARTS.some(p => localPart.includes(p))) return true;
  if (opts.gmailCategory === 'updates' || opts.gmailCategory === 'promotions' || opts.gmailCategory === 'social') return true;
  return false;
}
