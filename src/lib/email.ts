import { Resend } from 'resend';

// ── Site ──────────────────────────────────────────────────────────────────────

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://flowen.digital';

// ── Font stack ────────────────────────────────────────────────────────────────

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

// ── Email addresses ───────────────────────────────────────────────────────────
// All aliases route through admin@flowen.digital on Google Workspace.

export const FROM = {
  hello:     'Flowen <hello@flowen.digital>',
  noreply:   'Flowen <noreply@flowen.digital>',
  support:   'Flowen <support@flowen.digital>',
  clinical:  'Flowen Clinical <clinical@flowen.digital>',
  billing:   'Flowen Billing <billing@flowen.digital>',
  privacy:   'Flowen <privacy@flowen.digital>',
  security:  'Flowen Security <security@flowen.digital>',
  updates:   'Flowen <updates@flowen.digital>',
  investors: 'Howard at Flowen <investors@flowen.digital>',
  alerts:    'Flowen <alerts@flowen.digital>',
  press:     'Flowen Press <press@flowen.digital>',
  careers:   'Flowen Careers <careers@flowen.digital>',
} as const;

export const ADMIN_INBOX = 'hello@flowen.digital';

// ── Resend client ─────────────────────────────────────────────────────────────

function resend() {
  return new Resend(process.env.RESEND_API_KEY ?? '');
}

interface SendOpts {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  tags?: Array<{ name: string; value: string }>;
}

export async function sendEmail(opts: SendOpts): Promise<boolean> {
  try {
    const { error } = await resend().emails.send({
      from:     opts.from,
      to:       Array.isArray(opts.to) ? opts.to : [opts.to],
      subject:  opts.subject,
      html:     opts.html,
      text:     opts.text,
      replyTo:  opts.replyTo,
      cc:       opts.cc ? (Array.isArray(opts.cc) ? opts.cc : [opts.cc]) : undefined,
      tags:     opts.tags,
    });
    if (error) {
      console.error('[email] Resend error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send error:', err);
    return false;
  }
}

// ── Department config ─────────────────────────────────────────────────────────

type Dept = 'customer' | 'clinical' | 'billing' | 'privacy' | 'product' | 'security' | 'investors' | 'internal';

const DEPT: Record<Dept, { name: string; email: string; color: string }> = {
  customer:  { name: 'The Flowen Team',          email: 'support@flowen.digital',   color: '#10b981' },
  clinical:  { name: 'The Flowen Clinical Team',  email: 'clinical@flowen.digital',  color: '#0ea5e9' },
  billing:   { name: 'Flowen Billing',            email: 'billing@flowen.digital',   color: '#f59e0b' },
  privacy:   { name: 'Flowen Privacy',            email: 'privacy@flowen.digital',   color: '#8b5cf6' },
  product:   { name: 'The Flowen Product Team',   email: 'updates@flowen.digital',   color: '#6366f1' },
  security:  { name: 'Flowen Security',           email: 'security@flowen.digital',  color: '#ef4444' },
  investors: { name: 'Howard · Founder & CEO',    email: 'investors@flowen.digital', color: '#d97706' },
  internal:  { name: 'Flowen System',             email: 'alerts@flowen.digital',    color: '#64748b' },
};

// ── HTML primitives ───────────────────────────────────────────────────────────

function h1(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#e8edf5;letter-spacing:-0.6px;line-height:1.25;font-family:${FONT};">${text}</h1>`;
}

function h2(text: string) {
  return `<p style="margin:24px 0 8px;font-size:11px;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;color:#3a4d66;font-family:${FONT};">${text}</p>`;
}

function p(text: string, muted = false) {
  return `<p style="margin:0 0 14px;font-size:15px;color:${muted ? '#3a4d66' : '#8a9ab5'};line-height:1.75;font-family:${FONT};">${text}</p>`;
}

function btn(text: string, href: string, color = '#10b981') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
    <tr>
      <td bgcolor="${color}" style="background:${color};border-radius:6px;">
        <a href="${href}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#07090f;text-decoration:none;font-family:${FONT};">${text}</a>
      </td>
    </tr>
  </table>`;
}

function dataTable(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;border-collapse:collapse;">
    ${rows.map(([k, v], i) => `<tr>
      <td style="padding:10px 0;font-size:11px;font-weight:700;color:#3a4d66;text-transform:uppercase;letter-spacing:0.8px;white-space:nowrap;padding-right:24px;border-bottom:${i < rows.length - 1 ? '1px solid #141c28' : 'none'};vertical-align:top;font-family:${FONT};">${k}</td>
      <td style="padding:10px 0;font-size:13px;color:#c4cede;border-bottom:${i < rows.length - 1 ? '1px solid #141c28' : 'none'};font-family:${FONT};">${v}</td>
    </tr>`).join('')}
  </table>`;
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td height="1" bgcolor="#141c28" style="background:#141c28;font-size:1px;line-height:1px;">&nbsp;</td></tr>
  </table>`;
}

// Subtle note — replaces emoji callout boxes
function note(text: string) {
  return `<p style="margin:16px 0 0;font-size:13px;color:#3a4d66;line-height:1.7;font-family:${FONT};">${text}</p>`;
}

// ── Base HTML wrapper ─────────────────────────────────────────────────────────

interface WrapOpts {
  dept: Dept;
  category?: string;      // small-caps label above the h1 (e.g. 'Waitlist', 'Billing')
  preheader?: string;     // inbox preview text
  body: string;
  unsubscribeHref?: string;
}

function wrap({ dept, category, preheader, body, unsubscribeHref }: WrapOpts): string {
  const sig = DEPT[dept];
  const now = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Flowen</title>
</head>
<body style="margin:0;padding:0;background:#070a0f;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;">${preheader}&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;</div>` : ''}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#070a0f" style="background:#070a0f;">
    <tr>
      <td align="center" style="padding:48px 20px 40px;" bgcolor="#070a0f">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding:0 0 22px;">
              <a href="${SITE}" style="text-decoration:none;display:inline-block;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:10px;line-height:0;">
                      <!-- Dual waveform mark — hosted URL renders in all clients incl. Gmail -->
                      <img src="https://www.flowen.digital/email-logo.svg" width="52" height="26" alt="Flowen" style="display:block;border:0;outline:none;">
                    </td>
                    <td valign="middle">
                      <span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.8px;font-family:${FONT};">FLOWEN</span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="#0c1018" style="background:#0c1018;border-radius:10px;border:1px solid #141c28;">

              <!-- Dept accent line -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td height="2" bgcolor="${sig.color}" style="background:${sig.color};border-radius:9px 9px 0 0;font-size:2px;line-height:2px;">&nbsp;</td>
                </tr>
              </table>

              <!-- Content -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:32px 40px 36px;">

                    ${category ? `<p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${sig.color};font-family:${FONT};">${category}</p>` : ''}

                    ${body}

                    <!-- Sign-off -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                      <tr>
                        <td>
                          <p style="margin:0 0 2px;font-size:13px;color:#c4cede;font-family:${FONT};">${sig.name}</p>
                          <p style="margin:0;font-size:12px;font-family:${FONT};">
                            <a href="mailto:${sig.email}" style="color:${sig.color};text-decoration:none;">${sig.email}</a>
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 4px 0;">
              <p style="margin:0;font-size:11px;color:#1e2940;line-height:1.8;font-family:${FONT};">
                Flowen Speech Technology Ltd &middot; England &amp; Wales &middot; ${now}
                &nbsp;&middot;&nbsp;
                <a href="${SITE}/legal" style="color:#1e2940;text-decoration:none;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE}/legal" style="color:#1e2940;text-decoration:none;">Terms</a>
                &nbsp;&middot;&nbsp;
                <a href="${unsubscribeHref ?? `${SITE}/dashboard/settings`}" style="color:#1e2940;text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function gbpTime() {
  return new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' }) + ' (London)';
}

// ── 1. Waitlist confirmation ──────────────────────────────────────────────────

export async function sendWaitlistConfirmation(email: string) {
  await sendEmail({
    from:    FROM.hello,
    to:      email,
    subject: "You're on the Flowen waitlist",
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 'waitlist_confirmation' }],
    text:    `You're on the list.\n\nWe'll email you when your spot opens. In the meantime, visit ${SITE} to learn more.\n\nFlowen\nsupport@flowen.digital`,
    html: wrap({
      dept:      'customer',
      category:  'Waitlist',
      preheader: "We'll email you the moment your spot opens.",
      body: `
        ${h1("You're on the list.")}
        ${p("We'll email you when your spot opens. One email, no noise.")}
        ${note(`Questions in the meantime? Reply here or write to <a href="mailto:support@flowen.digital" style="color:#10b981;text-decoration:none;">support@flowen.digital</a>.`)}
      `,
    }),
  });
}

// ── 2. Admin — new waitlist lead ──────────────────────────────────────────────

export async function sendAdminWaitlistAlert(lead: {
  email: string;
  fullName?: string;
  planTier?: string;
  organization?: string;
}) {
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `New waitlist signup: ${lead.email}`,
    tags:    [{ name: 'type', value: 'admin_waitlist_alert' }],
    text:    `New waitlist lead.\n\nEmail: ${lead.email}\nName: ${lead.fullName ?? 'N/A'}\nPlan: ${lead.planTier ?? 'N/A'}\nOrg: ${lead.organization ?? 'N/A'}\nTime: ${gbpTime()}`,
    html: wrap({
      dept:      'internal',
      category:  'Waitlist',
      preheader: lead.email,
      body: `
        ${h1('New waitlist signup')}
        ${dataTable([
          ['Email',        lead.email],
          ['Name',         lead.fullName    ?? '—'],
          ['Plan',         lead.planTier    ?? '—'],
          ['Organisation', lead.organization ?? '—'],
          ['Time',         gbpTime()],
        ])}
        ${btn('View waitlist', `${SITE}/admin/waitlist`, '#64748b')}
      `,
    }),
  });
}

// ── 3. Waitlist invite ────────────────────────────────────────────────────────

export async function sendWaitlistInvite(opts: {
  email: string;
  inviteUrl: string;
  expiresAt?: string;
}) {
  const expiry = opts.expiresAt
    ? new Date(opts.expiresAt).toLocaleDateString('en-GB', { dateStyle: 'long' })
    : '7 days';

  await sendEmail({
    from:    FROM.hello,
    to:      opts.email,
    subject: 'Your Flowen access is ready',
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 'waitlist_invite' }],
    text:    `Your spot is ready.\n\nCreate your account: ${opts.inviteUrl}\n\nThis link expires ${expiry}.\n\nFlowen\nsupport@flowen.digital`,
    html: wrap({
      dept:      'customer',
      category:  'Access',
      preheader: 'Your Flowen invitation is ready.',
      body: `
        ${h1('Your spot is ready.')}
        ${p("Create your account and start your first practice session today.")}
        ${btn('Create my account', opts.inviteUrl)}
        ${note(`This invitation expires on ${expiry}.`)}
        ${note(`If you didn't sign up for the Flowen waitlist, you can safely ignore this email.`)}
      `,
    }),
  });
}

// ── 4. Welcome (post-onboarding) ──────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.hello,
    to:      email,
    subject: `Welcome to Flowen, ${displayName}`,
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 'welcome' }],
    text:    `Hi ${displayName},\n\nYour account is ready. Head to your dashboard to start your first session.\n\n${SITE}/dashboard\n\nFlowen\nsupport@flowen.digital`,
    html: wrap({
      dept:      'customer',
      category:  'Welcome',
      preheader: `Your account is ready, ${displayName}.`,
      body: `
        ${h1(`You're in, ${displayName}.`)}
        ${p("Your dashboard has everything you need — daily exercises, session history, and progress tracking.")}
        ${p("Start with Stage 1 (Breath Control) and do at least one session today. Consistency is what moves the needle.")}
        ${btn('Open my dashboard', `${SITE}/dashboard`)}
        ${note("Reply to this email with any questions.")}
      `,
    }),
  });
}

// ── 5. Admin — new user ───────────────────────────────────────────────────────

export async function sendAdminNewUserAlert(email: string, displayName: string, role: string) {
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `New user: ${displayName}`,
    tags:    [{ name: 'type', value: 'admin_new_user' }],
    text:    `${displayName} (${email}) completed onboarding. Role: ${role}. Time: ${gbpTime()}`,
    html: wrap({
      dept:      'internal',
      category:  'Users',
      preheader: `${displayName} completed onboarding.`,
      body: `
        ${h1('New user onboarded')}
        ${dataTable([
          ['Name',  displayName],
          ['Email', email],
          ['Role',  role],
          ['Time',  gbpTime()],
        ])}
        ${btn('View users', `${SITE}/admin/users`, '#64748b')}
      `,
    }),
  });
}

// ── 6. Payment confirmation ───────────────────────────────────────────────────

export async function sendPaymentConfirmation(opts: {
  email: string;
  displayName: string;
  tier: string;
  cycle: string;
  amountPence: number;
  currency: string;
  invoiceId?: string;
}) {
  const amount    = (opts.amountPence / 100).toLocaleString('en-GB', { style: 'currency', currency: opts.currency.toUpperCase() });
  const tierLabel = opts.tier === 'founding' ? 'Founding Member' : opts.tier.charAt(0).toUpperCase() + opts.tier.slice(1);
  const cycleLabel = opts.cycle.replace(/_/g, ' ');

  await sendEmail({
    from:    FROM.billing,
    to:      opts.email,
    subject: `Payment confirmed — Flowen ${tierLabel}`,
    replyTo: 'billing@flowen.digital',
    tags:    [{ name: 'type', value: 'payment_confirmation' }],
    text:    `Payment confirmed.\n\n${tierLabel} (${cycleLabel}) · ${amount}\n\nYour subscription is active. Manage it at ${SITE}/dashboard/billing.\n\nFlowen Billing\nbilling@flowen.digital`,
    html: wrap({
      dept:      'billing',
      category:  'Payment Confirmed',
      preheader: `${amount} received. Your ${tierLabel} subscription is active.`,
      body: `
        ${h1(`Payment received, ${opts.displayName}.`)}
        ${p(`Your <strong style="color:#e8edf5;">${tierLabel}</strong> subscription is now active.`)}
        ${dataTable([
          ['Plan',     `${tierLabel} · ${cycleLabel}`],
          ['Amount',   amount],
          ['Status',   'Active'],
          ...(opts.invoiceId ? [['Invoice', opts.invoiceId] as [string, string]] : []),
          ['Date',     gbpTime()],
        ])}
        ${btn('Go to my dashboard', `${SITE}/dashboard`)}
        ${note(`Manage or cancel your subscription at any time from <a href="${SITE}/dashboard/billing" style="color:#f59e0b;text-decoration:none;">Account &rarr; Billing</a>.`)}
      `,
    }),
  });
}

// ── 7. Admin — payment received ───────────────────────────────────────────────

export async function sendAdminPaymentAlert(opts: {
  email: string;
  tier: string;
  cycle: string;
  amountPence: number;
  currency: string;
  stripeCustomerId: string;
}) {
  const amount = (opts.amountPence / 100).toLocaleString('en-GB', { style: 'currency', currency: opts.currency.toUpperCase() });
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `New subscriber: ${opts.email} — ${amount}`,
    tags:    [{ name: 'type', value: 'admin_payment_alert' }],
    text:    `New payment: ${opts.email} · ${opts.tier} · ${amount}`,
    html: wrap({
      dept:      'internal',
      category:  'Payment',
      preheader: `${opts.email} · ${amount}`,
      body: `
        ${h1('New subscriber')}
        ${dataTable([
          ['Email',           opts.email],
          ['Tier',            opts.tier],
          ['Cycle',           opts.cycle.replace(/_/g, ' ')],
          ['Amount',          amount],
          ['Stripe customer', opts.stripeCustomerId],
          ['Time',            gbpTime()],
        ])}
        ${btn('View in Stripe', `https://dashboard.stripe.com/customers/${opts.stripeCustomerId}`, '#f59e0b')}
      `,
    }),
  });
}

// ── 8. Payment failed — user ──────────────────────────────────────────────────

export async function sendPaymentFailedUser(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.billing,
    to:      email,
    subject: 'Action required — Flowen payment failed',
    replyTo: 'billing@flowen.digital',
    tags:    [{ name: 'type', value: 'payment_failed_user' }],
    text:    `Hi ${displayName},\n\nWe couldn't process your Flowen subscription payment. Please update your payment details to keep your access.\n\n${SITE}/dashboard/billing\n\nFlowen Billing\nbilling@flowen.digital`,
    html: wrap({
      dept:      'billing',
      category:  'Action Required',
      preheader: 'Update your payment details to keep your access.',
      body: `
        ${h1(`Payment failed, ${displayName}.`)}
        ${p("We couldn't process your subscription renewal. Update your payment details now — Stripe will retry automatically once you do.")}
        ${btn('Update payment details', `${SITE}/dashboard/billing`, '#ef4444')}
        ${note(`Questions? Reply to this email or write to <a href="mailto:billing@flowen.digital" style="color:#f59e0b;text-decoration:none;">billing@flowen.digital</a>.`)}
      `,
    }),
  });
}

// ── 9. Admin — payment failed ─────────────────────────────────────────────────

export async function sendAdminPaymentFailedAlert(opts: {
  email: string;
  invoiceId: string;
  amountPence: number;
  currency: string;
  attemptCount: number;
}) {
  const amount = (opts.amountPence / 100).toLocaleString('en-GB', { style: 'currency', currency: opts.currency.toUpperCase() });
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `Payment failed: ${opts.email} — attempt ${opts.attemptCount}`,
    tags:    [{ name: 'type', value: 'admin_payment_failed' }],
    text:    `Payment failure: ${opts.email} · ${amount} · attempt ${opts.attemptCount}`,
    html: wrap({
      dept:      'internal',
      category:  'Payment Failed',
      preheader: `${opts.email} · attempt ${opts.attemptCount} · ${amount}`,
      body: `
        ${h1('Subscription payment failed')}
        ${dataTable([
          ['Email',      opts.email],
          ['Invoice',    opts.invoiceId],
          ['Amount due', amount],
          ['Attempt',    String(opts.attemptCount)],
          ['Time',       gbpTime()],
        ])}
        ${btn('View in Stripe', 'https://dashboard.stripe.com/invoices', '#ef4444')}
      `,
    }),
  });
}

// ── 10. Admin — support ticket ────────────────────────────────────────────────

export async function sendAdminSupportTicketAlert(opts: {
  userEmail: string;
  subject: string;
  body: string;
  category: string;
  ticketId: string;
  slaDueAt: string;
}) {
  const slaLabel = new Date(opts.slaDueAt).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' });
  const preview  = opts.body.slice(0, 140).replace(/\n/g, ' ');
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `[Support] ${opts.category.toUpperCase()}: ${opts.subject}`,
    replyTo: opts.userEmail,
    tags:    [{ name: 'type', value: 'admin_support_ticket' }],
    text:    `New support ticket from ${opts.userEmail}.\n\nCategory: ${opts.category}\nSubject: ${opts.subject}\nSLA: ${slaLabel}\n\n${opts.body}`,
    html: wrap({
      dept:      'internal',
      category:  'Support',
      preheader: preview,
      body: `
        ${h1('Support request')}
        ${dataTable([
          ['From',     opts.userEmail],
          ['Category', opts.category],
          ['SLA due',  slaLabel],
          ['Ticket',   opts.ticketId],
        ])}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
          <tr>
            <td bgcolor="#070a0f" style="background:#070a0f;border-radius:6px;border:1px solid #141c28;padding:16px 20px;">
              <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#3a4d66;text-transform:uppercase;letter-spacing:0.9px;font-family:${FONT};">Message</p>
              <p style="margin:0;font-size:14px;color:#8a9ab5;line-height:1.7;white-space:pre-wrap;font-family:${FONT};">${opts.body.slice(0, 1200)}${opts.body.length > 1200 ? '…' : ''}</p>
            </td>
          </tr>
        </table>
        ${btn('Reply to user', `mailto:${opts.userEmail}?subject=Re: [${opts.ticketId}] ${encodeURIComponent(opts.subject)}`, '#64748b')}
      `,
    }),
  });
}

// ── 11. Support ticket confirmation — user ────────────────────────────────────

export async function sendSupportTicketConfirmation(opts: {
  email: string;
  displayName: string;
  subject: string;
  ticketId: string;
  slaDueAt: string;
}) {
  const slaLabel = new Date(opts.slaDueAt).toLocaleDateString('en-GB', { dateStyle: 'long' });
  await sendEmail({
    from:    FROM.support,
    to:      opts.email,
    subject: `[${opts.ticketId}] We've received your request`,
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 'support_confirmation' }],
    text:    `Hi ${opts.displayName},\n\nYour support request has been received (${opts.ticketId}).\n\nWe aim to respond by ${slaLabel}.\n\nFlowen\nsupport@flowen.digital`,
    html: wrap({
      dept:      'customer',
      category:  'Support',
      preheader: `Ticket ${opts.ticketId} logged. We'll respond by ${slaLabel}.`,
      body: `
        ${h1(`Got it, ${opts.displayName}.`)}
        ${p("Your request has been logged. We'll get back to you within one business day.")}
        ${dataTable([
          ['Ticket',    opts.ticketId],
          ['Subject',   opts.subject],
          ['Reply by',  slaLabel],
        ])}
        ${note(`Reply to this email to add more detail, or write to <a href="mailto:support@flowen.digital" style="color:#10b981;text-decoration:none;">support@flowen.digital</a>.`)}
      `,
    }),
  });
}

// ── 12. GDPR request confirmation ─────────────────────────────────────────────

export async function sendGdprRequestConfirmation(opts: {
  email: string;
  displayName: string;
  requestType: 'erasure' | 'access' | 'portability' | 'rectification' | 'restriction';
  requestId: string;
}) {
  const typeLabels: Record<string, string> = {
    erasure:        'Right to Erasure',
    access:         'Subject Access Request',
    portability:    'Data Portability Request',
    rectification:  'Right to Rectification',
    restriction:    'Right to Restriction of Processing',
  };
  const label = typeLabels[opts.requestType] ?? opts.requestType;
  const due   = new Date(Date.now() + 30 * 86400_000).toLocaleDateString('en-GB', { dateStyle: 'long' });

  await sendEmail({
    from:    FROM.privacy,
    to:      opts.email,
    subject: `Your data request has been received — ${label}`,
    replyTo: 'privacy@flowen.digital',
    tags:    [{ name: 'type', value: 'gdpr_confirmation' }],
    text:    `Hi ${opts.displayName},\n\nWe have received your ${label} (Ref: ${opts.requestId}).\n\nUnder UK GDPR, we will respond within 30 calendar days (by ${due}).\n\nFlowen\nprivacy@flowen.digital`,
    html: wrap({
      dept:      'privacy',
      category:  'Data Request',
      preheader: `${label} received. We'll respond by ${due}.`,
      body: `
        ${h1('Data request received.')}
        ${p(`Hi ${opts.displayName}, we have received your ${label} and will respond in accordance with UK GDPR.`)}
        ${dataTable([
          ['Request type',  label],
          ['Reference',     opts.requestId],
          ['Date received', gbpTime()],
          ['Response due',  `${due} (30-day statutory limit)`],
        ])}
        ${note("Under UK GDPR Article 12, we must respond within one calendar month. For complex requests we may extend this by a further two months and will inform you in advance.")}
        ${note(`Questions? Reply to this email or write to <a href="mailto:privacy@flowen.digital" style="color:#8b5cf6;text-decoration:none;">privacy@flowen.digital</a>.`)}
      `,
    }),
  });
}

// ── 13. 3-day onboarding check-in ────────────────────────────────────────────

export async function sendCheckIn3d(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.hello,
    to:      email,
    subject: 'Quick check-in from Flowen',
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 'checkin_3d' }],
    text:    `Hi ${displayName},\n\nHow's it going? If you haven't started yet, now's a good time.\n\n${SITE}/dashboard/practice\n\nReply with any questions.\n\nFlowen`,
    html: wrap({
      dept:      'customer',
      category:  'Check-in',
      preheader: "How's it going?",
      body: `
        ${h1(`How's it going, ${displayName}?`)}
        ${p("Three days in — we wanted to check you're finding your feet.")}
        ${p("If you haven't started yet, Stage 1 (Breath Control) takes five minutes and is the best place to begin. Your progress builds from there.")}
        ${btn('Open practice', `${SITE}/dashboard/practice`)}
        ${note("Reply to this email with any questions.")}
      `,
    }),
  });
}

// ── 14. 7-day milestone ───────────────────────────────────────────────────────

export async function sendMilestone7d(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.hello,
    to:      email,
    subject: 'Your first week with Flowen',
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 'milestone_7d' }],
    text:    `Hi ${displayName},\n\nOne week in. The research is clear: consistency over time is where the real gains happen. You're building something real.\n\nFlowen`,
    html: wrap({
      dept:      'customer',
      category:  'One week',
      preheader: "One week in.",
      body: `
        ${h1(`One week in, ${displayName}.`)}
        ${p("The research is clear: consistent daily practice compounds. You're building real, measurable progress — keep the habit going.")}
        ${btn('View my progress', `${SITE}/dashboard`)}
      `,
    }),
  });
}

// ── 15. Re-engagement ─────────────────────────────────────────────────────────

export async function sendReEngagement(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.hello,
    to:      email,
    subject: 'Come back to Flowen',
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 're_engagement' }],
    text:    `Hi ${displayName},\n\nIt's been a while. Your progress is saved — pick up exactly where you left off.\n\n${SITE}/dashboard/practice\n\nFlowen`,
    html: wrap({
      dept:      'customer',
      category:  'We miss you',
      preheader: "Your progress is still there.",
      body: `
        ${h1(`Come back, ${displayName}.`)}
        ${p("It's been a while since your last session. Your progress is all saved — pick up exactly where you left off.")}
        ${p("Even five minutes today keeps the habit alive.")}
        ${btn('Resume practice', `${SITE}/dashboard/practice`)}
        ${note("Having trouble? Reply to this email and we'll help.")}
      `,
    }),
  });
}

// ── 16. Founding member offer ─────────────────────────────────────────────────

export async function sendFoundingOffer(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.hello,
    to:      email,
    subject: 'Founding member spot — Flowen',
    replyTo: 'hello@flowen.digital',
    tags:    [{ name: 'type', value: 'founding_offer' }],
    text:    `Hi ${displayName},\n\nWe're inviting a small group of waitlist members to join Flowen as Founding Members — locked-in pricing for life and direct access to the product team.\n\n${SITE}/pricing\n\nFlowen`,
    html: wrap({
      dept:      'customer',
      category:  'Founding Member',
      preheader: "A founding spot — yours if you want it.",
      body: `
        ${h1(`A founding spot for you, ${displayName}.`)}
        ${p("We're inviting a small group from the waitlist to join Flowen as Founding Members.")}
        ${p("Founding Members get price-locked access for life, direct input into what we build, and early access to everything that comes next. Spots are strictly limited.")}
        ${btn('Claim my founding spot', `${SITE}/pricing`, '#d97706')}
        ${note("This offer is personal to you. Reply with any questions.")}
      `,
    }),
  });
}

// ── 17. Trial ending / upgrade nudge ─────────────────────────────────────────

export async function sendUpgradeNudge(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.billing,
    to:      email,
    subject: 'Your Flowen trial is ending soon',
    replyTo: 'billing@flowen.digital',
    tags:    [{ name: 'type', value: 'upgrade_nudge' }],
    text:    `Hi ${displayName},\n\nYour Flowen trial is ending soon. Upgrade to keep access to your sessions and progress.\n\n${SITE}/pricing\n\nFlowen Billing`,
    html: wrap({
      dept:      'billing',
      category:  'Trial ending',
      preheader: "Keep your access — upgrade before your trial ends.",
      body: `
        ${h1(`Trial ending soon, ${displayName}.`)}
        ${p("Your Flowen trial is coming to an end. Upgrade to keep uninterrupted access to your practice sessions and progress history.")}
        ${btn('See plans', `${SITE}/pricing`, '#f59e0b')}
        ${note(`Questions about which plan is right for you? Reply here or write to <a href="mailto:billing@flowen.digital" style="color:#f59e0b;text-decoration:none;">billing@flowen.digital</a>.`)}
      `,
    }),
  });
}

// ── 18. Admin workflow alert ──────────────────────────────────────────────────

export async function sendAdminWorkflowAlert(opts: {
  workflowName: string;
  userEmail: string;
  userName: string;
  detail?: string;
}) {
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `Workflow: ${opts.workflowName} — ${opts.userEmail}`,
    tags:    [{ name: 'type', value: 'admin_workflow_alert' }],
    text:    `Workflow: ${opts.workflowName}\nUser: ${opts.userName} <${opts.userEmail}>\nTime: ${gbpTime()}${opts.detail ? `\nDetail: ${opts.detail}` : ''}`,
    html: wrap({
      dept:      'internal',
      category:  'Workflow',
      preheader: `${opts.workflowName} · ${opts.userEmail}`,
      body: `
        ${h1(opts.workflowName)}
        ${dataTable([
          ['User',   opts.userName],
          ['Email',  opts.userEmail],
          ['Time',   gbpTime()],
          ...(opts.detail ? [['Detail', opts.detail] as [string, string]] : []),
        ])}
        ${btn('View admin', `${SITE}/admin`, '#64748b')}
      `,
    }),
  });
}

// ── 19. Security alert ────────────────────────────────────────────────────────

export async function sendSecurityAlert(opts: {
  email: string;
  displayName: string;
  eventType: 'new_device' | 'password_changed' | 'suspicious_login' | 'account_locked';
  detail?: string;
  ip?: string;
  location?: string;
}) {
  const eventLabels: Record<string, string> = {
    new_device:       'New device sign-in',
    password_changed: 'Password changed',
    suspicious_login: 'Suspicious login detected',
    account_locked:   'Account temporarily locked',
  };
  const label         = eventLabels[opts.eventType] ?? opts.eventType;
  const isHighSeverity = ['suspicious_login', 'account_locked'].includes(opts.eventType);

  await sendEmail({
    from:    FROM.security,
    to:      opts.email,
    subject: `Security alert: ${label}`,
    replyTo: 'security@flowen.digital',
    tags:    [{ name: 'type', value: 'security_alert' }],
    text:    `Security alert: ${label}\n\nIf this wasn't you, contact security@flowen.digital immediately.\n\nFlowen Security`,
    html: wrap({
      dept:      'security',
      category:  isHighSeverity ? 'Urgent Security Alert' : 'Security Notice',
      preheader: `${label} on your Flowen account.`,
      body: `
        ${h1(label)}
        ${p(`Hi ${opts.displayName}, we detected the following event on your Flowen account.`)}
        ${dataTable([
          ['Event',    label],
          ['Time',     gbpTime()],
          ...(opts.ip       ? [['IP address', opts.ip]       as [string, string]] : []),
          ...(opts.location ? [['Location',   opts.location] as [string, string]] : []),
          ...(opts.detail   ? [['Details',    opts.detail]   as [string, string]] : []),
        ])}
        ${isHighSeverity
          ? note(`If this was not you, <strong style="color:#e8edf5;">contact <a href="mailto:security@flowen.digital" style="color:#ef4444;text-decoration:none;">security@flowen.digital</a> immediately</strong> and change your password.`)
          : note(`If this was you, no action is needed. If you don't recognise this activity, write to <a href="mailto:security@flowen.digital" style="color:#ef4444;text-decoration:none;">security@flowen.digital</a>.`)
        }
        ${btn('Review account security', `${SITE}/dashboard/settings`, '#ef4444')}
      `,
    }),
  });
}

// ── 20. Clinician — patient report ───────────────────────────────────────────

export async function sendClinicalReport(opts: {
  clinicianEmail: string;
  clinicianName: string;
  patientName: string;
  reportPeriod: string;
  sessionsCompleted: number;
  avgAccuracy: number;
  topTechnique: string;
  notes: string;
  reportUrl: string;
}) {
  await sendEmail({
    from:    FROM.clinical,
    to:      opts.clinicianEmail,
    subject: `Patient report: ${opts.patientName} — ${opts.reportPeriod}`,
    replyTo: 'clinical@flowen.digital',
    tags:    [{ name: 'type', value: 'clinical_report' }],
    text:    `Weekly report: ${opts.patientName} (${opts.reportPeriod})\n\nSessions: ${opts.sessionsCompleted}\nAvg. accuracy: ${opts.avgAccuracy}%\nTop technique: ${opts.topTechnique}\n\nNotes:\n${opts.notes}\n\nFull report: ${opts.reportUrl}\n\nThe Flowen Clinical Team`,
    html: wrap({
      dept:      'clinical',
      category:  'Clinical Report',
      preheader: `${opts.patientName} · ${opts.reportPeriod} · ${opts.sessionsCompleted} sessions`,
      body: `
        ${h1(`Patient report: ${opts.patientName}`)}
        ${p(`Hi ${opts.clinicianName}, here's the practice summary for <strong style="color:#e8edf5;">${opts.reportPeriod}</strong>.`)}
        ${dataTable([
          ['Sessions completed', String(opts.sessionsCompleted)],
          ['Average accuracy',   `${opts.avgAccuracy}%`],
          ['Top technique',      opts.topTechnique],
          ['Generated',          gbpTime()],
        ])}
        ${h2('Clinical notes')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
          <tr>
            <td bgcolor="#070a0f" style="background:#070a0f;border-radius:6px;border:1px solid #141c28;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#8a9ab5;line-height:1.7;font-family:${FONT};">${opts.notes}</p>
            </td>
          </tr>
        </table>
        ${btn('View full report', opts.reportUrl, '#0ea5e9')}
      `,
    }),
  });
}

// ── 21. Product update / changelog ────────────────────────────────────────────

export type ChangeType = 'new' | 'improved' | 'fixed' | 'security' | 'policy';

export interface ChangelogItem {
  type: ChangeType;
  title: string;
  description: string;
  href?: string;
  linkText?: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  summary: string;
  items: ChangelogItem[];
}

const CHANGE_META: Record<ChangeType, { label: string; color: string }> = {
  new:      { label: 'New',      color: '#10b981' },
  improved: { label: 'Improved', color: '#6366f1' },
  fixed:    { label: 'Fixed',    color: '#3b82f6' },
  security: { label: 'Security', color: '#ef4444' },
  policy:   { label: 'Policy',   color: '#8b5cf6' },
};

export function buildChangelogHtml(release: ChangelogRelease): string {
  const dateLabel = new Date(release.date).toLocaleDateString('en-GB', { dateStyle: 'long' });
  const order: ChangeType[] = ['security', 'policy', 'new', 'improved', 'fixed'];
  const grouped = new Map<ChangeType, ChangelogItem[]>();
  for (const type of order) grouped.set(type, []);
  for (const item of release.items) grouped.get(item.type)!.push(item);

  const sections = order
    .filter(t => grouped.get(t)!.length > 0)
    .map(type => {
      const meta  = CHANGE_META[type];
      const items = grouped.get(type)!;
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
          <tr>
            <td>
              <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${meta.color};font-family:${FONT};">${meta.label}</p>
            </td>
          </tr>
        </table>
        ${items.map(item => `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-left:2px solid ${meta.color}40;">
            <tr>
              <td style="padding:12px 16px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#c4cede;font-family:${FONT};">${item.title}</p>
                <p style="margin:0;font-size:13px;color:#3a4d66;line-height:1.6;font-family:${FONT};">${item.description}</p>
                ${item.href ? `<a href="${item.href}" style="display:inline-block;margin-top:6px;font-size:12px;color:${meta.color};text-decoration:none;font-weight:600;font-family:${FONT};">${item.linkText ?? 'View'} &rarr;</a>` : ''}
              </td>
            </tr>
          </table>
        `).join('')}
      `;
    }).join('');

  return wrap({
    dept:             'product',
    category:         `Version ${release.version}`,
    preheader:        release.summary,
    unsubscribeHref:  `${SITE}/dashboard/settings`,
    body: `
      ${h1("What's new in Flowen")}
      <p style="margin:-8px 0 20px;font-size:12px;color:#3a4d66;font-family:${FONT};">${dateLabel} &middot; ${release.version}</p>
      ${p(release.summary)}
      ${sections}
      ${divider()}
      ${btn('See full changelog', `${SITE}/changelog`, '#6366f1')}
      ${note(`Questions? Reply to this email or write to <a href="mailto:updates@flowen.digital" style="color:#6366f1;text-decoration:none;">updates@flowen.digital</a>.`)}
    `,
  });
}

export async function sendProductUpdate(opts: {
  to: string | string[];
  release: ChangelogRelease;
}): Promise<boolean> {
  const dateLabel = new Date(opts.release.date).toLocaleDateString('en-GB', { dateStyle: 'long' });
  return sendEmail({
    from:    FROM.updates,
    to:      opts.to,
    subject: `Flowen ${opts.release.version} — ${opts.release.summary}`,
    replyTo: 'updates@flowen.digital',
    tags:    [{ name: 'type', value: 'product_update' }],
    text:    `Flowen ${opts.release.version} · ${dateLabel}\n\n${opts.release.summary}\n\n${opts.release.items.map(i => `[${i.type.toUpperCase()}] ${i.title}\n${i.description}${i.href ? `\n${i.href}` : ''}`).join('\n\n')}\n\nSee full changelog: ${SITE}/changelog`,
    html:    buildChangelogHtml(opts.release),
  });
}

// ── 22. Investor update ───────────────────────────────────────────────────────

export async function sendInvestorUpdate(opts: {
  to: string | string[];
  subject: string;
  period: string;
  headline: string;
  body: string;
  metrics?: Array<[string, string]>;
  attachments?: string;
}) {
  await sendEmail({
    from:    FROM.investors,
    to:      opts.to,
    subject: opts.subject,
    replyTo: 'investors@flowen.digital',
    tags:    [{ name: 'type', value: 'investor_update' }],
    text:    `${opts.headline}\n\n${opts.body}\n\nHoward · Flowen Founder & CEO\ninvestors@flowen.digital`,
    html: wrap({
      dept:      'investors',
      category:  `Investor Update · ${opts.period}`,
      preheader: opts.headline,
      body: `
        ${h1(opts.headline)}
        ${p(opts.body)}
        ${opts.metrics && opts.metrics.length > 0 ? dataTable(opts.metrics) : ''}
        ${opts.attachments ? note(opts.attachments) : ''}
        ${btn('Investor portal', `${SITE}/admin/venture`, '#d97706')}
      `,
    }),
  });
}

// ── Broadcast HTML builder (used by admin broadcast route) ────────────────────
// Takes freeform subject + plain-text body from the admin UI and wraps it in
// the shared email shell. Paragraphs are split on newlines.

export function buildBroadcastHtml(subject: string, body: string): string {
  const paragraphs = body
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `<p style="margin:0 0 14px;font-size:15px;color:#8a9ab5;line-height:1.75;font-family:${FONT};">${l}</p>`)
    .join('');

  return wrap({
    dept:      'product',
    preheader: subject,
    body: `
      <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#e8edf5;letter-spacing:-0.6px;line-height:1.25;font-family:${FONT};">${subject}</h1>
      ${paragraphs}
    `,
    unsubscribeHref: `${SITE}/dashboard/settings`,
  });
}

// ── Deprecated alias ──────────────────────────────────────────────────────────

/** @deprecated use sendAdminWaitlistAlert */
export const sendWaitlistNotification = sendAdminWaitlistAlert;
