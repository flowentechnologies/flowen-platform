import { Resend } from 'resend';

// ── Site ──────────────────────────────────────────────────────────────────────

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://flowen.digital';

// ── Email addresses ───────────────────────────────────────────────────────────
// Google Workspace inboxes on flowen.digital. Each maps to a Google Workspace
// user or alias. Route these groups in the Google Admin console as needed.

export const FROM = {
  hello:     'Flowen <hello@flowen.digital>',          // general / waitlist / welcome
  noreply:   'Flowen <noreply@flowen.digital>',        // transactional (auth, receipts)
  support:   'Flowen Support <support@flowen.digital>', // customer success
  clinical:  'Flowen Clinical Team <clinical@flowen.digital>', // SLP / clinical
  billing:   'Flowen Billing <billing@flowen.digital>', // payments / invoices
  privacy:   'Flowen Privacy <privacy@flowen.digital>', // GDPR / data requests
  security:  'Flowen Security <security@flowen.digital>', // vulnerability reports
  updates:   'Flowen Updates <updates@flowen.digital>', // product changelog / newsletter
  investors: 'Flowen Investor Relations <investors@flowen.digital>', // IR
  alerts:    'Flowen Alerts <alerts@flowen.digital>',  // internal admin alerts
  press:     'Flowen Press <press@flowen.digital>',    // media / PR
  careers:   'Flowen Careers <careers@flowen.digital>', // recruitment
} as const;

// Admin receiving address (Google Workspace primary inbox)
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

// ── HTML primitives ───────────────────────────────────────────────────────────

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-size:26px;font-weight:900;color:#f1f5f9;letter-spacing:-0.6px;line-height:1.2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${text}</h1>`;
}

function h2(text: string) {
  return `<h2 style="margin:24px 0 8px;font-size:16px;font-weight:700;color:#f1f5f9;letter-spacing:-0.2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${text}</h2>`;
}

function p(text: string, muted = false) {
  return `<p style="margin:10px 0;font-size:15px;color:${muted ? '#64748b' : '#94a3b8'};line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${text}</p>`;
}

function btn(text: string, href: string, color = '#10b981') {
  const textColor = color === '#10b981' ? '#0f172a' : '#f8fafc';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
    <tr>
      <td style="background:${color};border-radius:10px;">
        <a href="${href}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${textColor};text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${text} →</a>
      </td>
    </tr>
  </table>`;
}

function chip(text: string, color = '#10b981', bg = '#022c22') {
  return `<span style="display:inline-block;background:${bg};color:${color};border:1px solid ${color}40;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;letter-spacing:1.2px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${text}</span>`;
}

function dataTable(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;border-radius:10px;overflow:hidden;background:#0d1117;">
    ${rows.map(([k, v], i) => `<tr>
      <td style="padding:11px 16px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;border-bottom:${i < rows.length - 1 ? '1px solid #1e293b' : 'none'};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${k}</td>
      <td style="padding:11px 16px;font-size:14px;color:#e2e8f0;border-bottom:${i < rows.length - 1 ? '1px solid #1e293b' : 'none'};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${v}</td>
    </tr>`).join('')}
  </table>`;
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td height="1" style="background:#1e293b;font-size:1px;">&nbsp;</td></tr>
  </table>`;
}

function callout(text: string, icon = 'ℹ️') {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <tr>
      <td style="background:#0f172a;border-left:3px solid #10b981;border-radius:0 8px 8px 0;padding:14px 18px;">
        <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${icon}&nbsp; ${text}</p>
      </td>
    </tr>
  </table>`;
}

// ── Department signatures ─────────────────────────────────────────────────────

type Dept = 'customer' | 'clinical' | 'billing' | 'privacy' | 'product' | 'security' | 'investors' | 'internal';

const SIGS: Record<Dept, { name: string; email: string; line2?: string; line3?: string; color: string }> = {
  customer: {
    name:  'The Flowen Customer Success Team',
    email: 'support@flowen.digital',
    line2: 'Monday to Friday, 9am – 6pm GMT',
    color: '#10b981',
  },
  clinical: {
    name:  'The Flowen Clinical Team',
    email: 'clinical@flowen.digital',
    line2: 'RCSLT-affiliated Speech & Language Therapists',
    line3: 'Clinical matters are treated in the strictest confidence',
    color: '#14b8a6',
  },
  billing: {
    name:  'Flowen Billing Support',
    email: 'billing@flowen.digital',
    line2: 'Subscription & invoice queries · Monday to Friday',
    color: '#f59e0b',
  },
  privacy: {
    name:  'Flowen Data Protection Team',
    email: 'privacy@flowen.digital',
    line2: 'UK GDPR requests processed within 30 days',
    line3: 'This communication is confidential',
    color: '#8b5cf6',
  },
  product: {
    name:  'The Flowen Product Team',
    email: 'updates@flowen.digital',
    line2: 'Share feedback: hello@flowen.digital',
    color: '#6366f1',
  },
  security: {
    name:  'Flowen Security Team',
    email: 'security@flowen.digital',
    line2: 'Responsible disclosure & vulnerability reports',
    color: '#ef4444',
  },
  investors: {
    name:  'Howard · Founder & CEO',
    email: 'investors@flowen.digital',
    line2: 'Flowen Speech Technology Ltd',
    line3: 'Registered in England & Wales',
    color: '#d97706',
  },
  internal: {
    name:  'Flowen Automated System',
    email: 'alerts@flowen.digital',
    line2: 'Do not reply · Internal alert only',
    color: '#f97316',
  },
};

function signature(dept: Dept) {
  const sig = SIGS[dept];
  return `${divider()}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td width="3" style="background:${sig.color};border-radius:2px;min-height:48px;">&nbsp;</td>
      <td style="padding-left:16px;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${sig.name}</p>
        <p style="margin:4px 0 0;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          <a href="mailto:${sig.email}" style="color:${sig.color};text-decoration:none;">${sig.email}</a>
          <span style="color:#334155;"> · </span>
          <a href="${SITE}" style="color:#4b5563;text-decoration:none;">flowen.digital</a>
        </p>
        ${sig.line2 ? `<p style="margin:3px 0 0;font-size:12px;color:#4b5563;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${sig.line2}</p>` : ''}
        ${sig.line3 ? `<p style="margin:2px 0 0;font-size:12px;color:#4b5563;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${sig.line3}</p>` : ''}
      </td>
    </tr>
  </table>`;
}

// ── Base HTML wrapper ─────────────────────────────────────────────────────────

interface WrapOpts {
  dept: Dept;
  chipLabel: string;
  chipColor?: string;
  chipBg?: string;
  body: string;
  unsubscribeHref?: string;
}

function wrap({ dept, chipLabel, chipColor, chipBg, body, unsubscribeHref }: WrapOpts) {
  const sig = SIGS[dept];
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
<body style="margin:0;padding:0;background:#060a10;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader (hidden, shows in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#060a10;">&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;</div>

  <!-- Outer table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#060a10;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#0d1117;border-radius:16px;border:1px solid #1e293b;overflow:hidden;">

          <!-- ── Header ── -->
          <tr>
            <td style="padding:28px 36px 24px;border-bottom:1px solid #1e293b;background:#060a10;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <!-- Tricolour bar -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                      <tr>
                        <td width="18" height="3" style="background:#f59e0b;border-radius:2px 0 0 2px;font-size:1px;line-height:1px;">&nbsp;</td>
                        <td width="2" style="font-size:1px;">&nbsp;</td>
                        <td width="18" height="3" style="background:#10b981;font-size:1px;line-height:1px;">&nbsp;</td>
                        <td width="2" style="font-size:1px;">&nbsp;</td>
                        <td width="18" height="3" style="background:#14b8a6;border-radius:0 2px 2px 0;font-size:1px;line-height:1px;">&nbsp;</td>
                      </tr>
                    </table>
                    <a href="${SITE}" style="text-decoration:none;display:block;">
                      <span style="font-size:21px;font-weight:900;color:#10b981;letter-spacing:-1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">flowen</span>
                      <span style="font-size:11px;color:#374151;margin-left:6px;font-weight:400;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">speech technology</span>
                    </a>
                  </td>
                  <td align="right" valign="bottom">
                    ${chip(chipLabel, chipColor ?? sig.color, chipBg ?? '#0d1117')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:32px 36px 8px;background:#0d1117;">
              ${body}
              ${signature(dept)}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="padding:20px 36px;background:#060a10;border-top:1px solid #1e293b;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px;font-size:11px;color:#1f2937;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                      Flowen Speech Technology Ltd · Registered in England &amp; Wales · ${now}
                    </p>
                    <p style="margin:0;font-size:11px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                      <a href="${SITE}/legal" style="color:#374151;text-decoration:none;">Privacy Policy</a>
                      <span style="color:#1f2937;"> · </span>
                      <a href="${SITE}/legal" style="color:#374151;text-decoration:none;">Terms of Service</a>
                      <span style="color:#1f2937;"> · </span>
                      <a href="${unsubscribeHref ?? `${SITE}/dashboard/settings`}" style="color:#374151;text-decoration:none;">Email Preferences</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

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
    text: `Thanks for joining the Flowen waitlist.\n\nWe'll email you the moment your access is ready. In the meantime, visit ${SITE} to learn more about how Flowen helps people who stutter build real fluency.\n\nThe Flowen Customer Success Team\nsupport@flowen.digital`,
    html: wrap({
      dept: 'customer',
      chipLabel: 'WAITLIST CONFIRMED',
      chipColor: '#10b981',
      body: `
        ${h1("You're on the list.")}
        ${p("Thanks for joining — you're now on the Flowen waitlist. We'll send you a personal invitation the moment your spot opens.")}
        ${p("Flowen is a voice-based fluency practice platform built for people who stutter, developed with clinical input and grounded in evidence-based technique.")}
        ${callout("We'll never share your email. Expect one email when your access is ready, and nothing else.", '🔒')}
        ${btn('Learn more about Flowen', SITE)}
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
    text: `New waitlist lead.\n\nEmail: ${lead.email}\nName: ${lead.fullName ?? 'N/A'}\nPlan: ${lead.planTier ?? 'N/A'}\nOrg: ${lead.organization ?? 'N/A'}\nTime: ${gbpTime()}`,
    html: wrap({
      dept: 'internal',
      chipLabel: 'WAITLIST ALERT',
      chipColor: '#f97316',
      body: `
        ${h1('New waitlist signup')}
        ${dataTable([
          ['Email',        lead.email],
          ['Name',         lead.fullName    ?? '—'],
          ['Plan',         lead.planTier    ?? '—'],
          ['Organisation', lead.organization ?? '—'],
          ['Time',         gbpTime()],
        ])}
        ${btn('Open admin panel', `${SITE}/admin/waitlist`, '#f97316')}
      `,
    }),
  });
}

// ── 3. Waitlist invite (invite link) ─────────────────────────────────────────

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
    subject: "Your Flowen access is ready",
    replyTo: 'support@flowen.digital',
    tags:    [{ name: 'type', value: 'waitlist_invite' }],
    text: `Your Flowen access is ready.\n\nCreate your account here: ${opts.inviteUrl}\n\nThis link expires ${expiry}.\n\nThe Flowen Customer Success Team`,
    html: wrap({
      dept: 'customer',
      chipLabel: 'ACCESS GRANTED',
      chipColor: '#10b981',
      body: `
        ${h1("Your spot is ready.")}
        ${p("You're invited to join Flowen. Click below to create your account and start your first practice session.")}
        ${btn('Create my account', opts.inviteUrl)}
        ${callout(`This invitation expires on ${expiry}. After that, you'll need to re-join the waitlist.`, '⏳')}
        ${p("If you didn't sign up for the Flowen waitlist, you can safely ignore this email.", true)}
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
    text: `Hi ${displayName},\n\nYour Flowen account is set up. Head to ${SITE}/dashboard to start your first practice session.\n\nThe Flowen Customer Success Team`,
    html: wrap({
      dept: 'customer',
      chipLabel: 'WELCOME',
      chipColor: '#10b981',
      body: `
        ${h1(`Hi ${displayName}, you're in.`)}
        ${p("Your Flowen account is ready. Your dashboard gives you daily practice exercises, session analytics, fluency tracking, and direct messaging with your speech-language pathologist.")}
        ${btn('Open my dashboard', `${SITE}/dashboard`)}
        ${divider()}
        ${h2('Getting started')}
        ${p("✦ Start with Stage 1 — Breath Control exercises (5 min).<br>✦ Complete a session daily for the first week to build your baseline.<br>✦ Your clinician will review your progress and update your plan weekly.")}
        ${p("Reply to this email with any questions — we read every message.", true)}
      `,
    }),
  });
}

// ── 5. Admin — new user ───────────────────────────────────────────────────────

export async function sendAdminNewUserAlert(email: string, displayName: string, role: string) {
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `New user onboarded: ${displayName}`,
    tags:    [{ name: 'type', value: 'admin_new_user' }],
    text:    `${displayName} (${email}) completed onboarding. Role: ${role}. Time: ${gbpTime()}`,
    html: wrap({
      dept: 'internal',
      chipLabel: 'NEW USER',
      chipColor: '#10b981',
      body: `
        ${h1('New user onboarded')}
        ${dataTable([
          ['Name',  displayName],
          ['Email', email],
          ['Role',  role],
          ['Time',  gbpTime()],
        ])}
        ${btn('View in admin', `${SITE}/admin/users`, '#10b981')}
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
  const amount = (opts.amountPence / 100).toLocaleString('en-GB', { style: 'currency', currency: opts.currency.toUpperCase() });
  const tierLabel = opts.tier === 'founding' ? 'Founding Member' : opts.tier.charAt(0).toUpperCase() + opts.tier.slice(1);
  const cycleLabel = opts.cycle.replace('_', ' ');

  await sendEmail({
    from:    FROM.billing,
    to:      opts.email,
    subject: `Payment confirmed — Flowen ${tierLabel}`,
    replyTo: 'billing@flowen.digital',
    tags:    [{ name: 'type', value: 'payment_confirmation' }],
    text: `Hi ${opts.displayName},\n\nThank you for your payment of ${amount}. Your ${tierLabel} (${cycleLabel}) subscription is now active.\n\nFlowen Billing\nbilling@flowen.digital`,
    html: wrap({
      dept: 'billing',
      chipLabel: 'PAYMENT CONFIRMED',
      chipColor: '#f59e0b',
      chipBg: '#1c1209',
      body: `
        ${h1(`Thank you, ${opts.displayName}.`)}
        ${p(`Your payment of <strong style="color:#f1f5f9;">${amount}</strong> has been received and your <strong style="color:#10b981;">${tierLabel}</strong> subscription is now active.`)}
        ${dataTable([
          ['Plan',       `${tierLabel} · ${cycleLabel}`],
          ['Amount',     amount],
          ['Status',     '&#10003; Active'],
          ...(opts.invoiceId ? [['Invoice', opts.invoiceId] as [string, string]] : []),
          ['Date',       gbpTime()],
        ])}
        ${btn('Go to my dashboard', `${SITE}/dashboard`)}
        ${callout('Keep this email as your payment record. To manage your subscription, go to Account Settings.', '📋')}
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
    text: `New payment: ${opts.email} · ${opts.tier} · ${amount}`,
    html: wrap({
      dept: 'internal',
      chipLabel: 'NEW SUBSCRIBER',
      chipColor: '#f59e0b',
      body: `
        ${h1('Payment received')}
        ${dataTable([
          ['Email',           opts.email],
          ['Tier',            opts.tier],
          ['Cycle',           opts.cycle.replace('_', ' ')],
          ['Amount',          amount],
          ['Stripe customer', opts.stripeCustomerId],
          ['Time',            gbpTime()],
        ])}
        ${btn('View in Stripe', 'https://dashboard.stripe.com/customers', '#f59e0b')}
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
    text: `Hi ${displayName},\n\nWe could not process your Flowen subscription payment. Please update your payment details to avoid losing access.\n\nFlowen Billing\nbilling@flowen.digital`,
    html: wrap({
      dept: 'billing',
      chipLabel: 'ACTION REQUIRED',
      chipColor: '#ef4444',
      chipBg: '#1c0f0f',
      body: `
        ${h1('Payment failed')}
        ${p(`Hi ${displayName}, we weren't able to process your Flowen subscription payment.`)}
        ${p("Please update your payment details to keep your access. Stripe will retry automatically — updating now avoids any interruption to your practice.")}
        ${btn('Update payment details', `${SITE}/dashboard/settings`, '#ef4444')}
        ${callout('Questions? Reply to this email or contact billing@flowen.digital — we\'re happy to help.', '💬')}
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
    text: `Payment failure: ${opts.email} · ${amount} · attempt ${opts.attemptCount}`,
    html: wrap({
      dept: 'internal',
      chipLabel: 'PAYMENT FAILED',
      chipColor: '#ef4444',
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
  await sendEmail({
    from:    FROM.alerts,
    to:      ADMIN_INBOX,
    subject: `[Support] ${opts.category.toUpperCase()}: ${opts.subject}`,
    replyTo: opts.userEmail,
    tags:    [{ name: 'type', value: 'admin_support_ticket' }],
    text: `New support ticket from ${opts.userEmail}.\n\nCategory: ${opts.category}\nSubject: ${opts.subject}\nSLA: ${slaLabel}\n\n${opts.body}`,
    html: wrap({
      dept: 'internal',
      chipLabel: 'SUPPORT TICKET',
      chipColor: '#3b82f6',
      body: `
        ${h1('New support request')}
        ${dataTable([
          ['From',     opts.userEmail],
          ['Category', opts.category],
          ['SLA due',  slaLabel],
          ['Ticket',   opts.ticketId],
        ])}
        <div style="background:#060a10;border-radius:10px;padding:18px 20px;margin:16px 0;">
          <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;font-family:monospace;">Message</p>
          <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${opts.body.slice(0, 1200)}${opts.body.length > 1200 ? '…' : ''}</p>
        </div>
        ${btn('Reply to user', `mailto:${opts.userEmail}?subject=Re: [${opts.ticketId}] ${encodeURIComponent(opts.subject)}`, '#3b82f6')}
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
    text: `Hi ${opts.displayName},\n\nYour support request has been received (Ticket: ${opts.ticketId}).\n\nWe aim to respond by ${slaLabel}.\n\nFlowen Support\nsupport@flowen.digital`,
    html: wrap({
      dept: 'customer',
      chipLabel: 'TICKET RECEIVED',
      chipColor: '#3b82f6',
      body: `
        ${h1(`We've got your request, ${opts.displayName}.`)}
        ${p("Your support request has been logged and we're on it. Our team typically responds within one business day.")}
        ${dataTable([
          ['Ticket',    opts.ticketId],
          ['Subject',   opts.subject],
          ['SLA target', slaLabel],
        ])}
        ${callout("Reply to this email to add information to your ticket, or contact support@flowen.digital.", '💬')}
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
    erasure:        'Right to Erasure (Right to be Forgotten)',
    access:         'Subject Access Request',
    portability:    'Data Portability Request',
    rectification:  'Right to Rectification',
    restriction:    'Right to Restriction of Processing',
  };
  const label = typeLabels[opts.requestType] ?? opts.requestType;
  const due = new Date(Date.now() + 30 * 86400_000).toLocaleDateString('en-GB', { dateStyle: 'long' });

  await sendEmail({
    from:    FROM.privacy,
    to:      opts.email,
    subject: `Your GDPR request has been received — ${label}`,
    replyTo: 'privacy@flowen.digital',
    tags:    [{ name: 'type', value: 'gdpr_confirmation' }],
    text: `Hi ${opts.displayName},\n\nWe have received your ${label} (Ref: ${opts.requestId}).\n\nUnder UK GDPR, we will respond within 30 calendar days (by ${due}).\n\nFlowen Data Protection Team\nprivacy@flowen.digital`,
    html: wrap({
      dept: 'privacy',
      chipLabel: 'GDPR REQUEST',
      chipColor: '#8b5cf6',
      chipBg: '#130d21',
      body: `
        ${h1('Your data request has been received.')}
        ${p(`Hi ${opts.displayName}, we have received your request and will process it in accordance with UK GDPR.`)}
        ${dataTable([
          ['Request type',  label],
          ['Reference',     opts.requestId],
          ['Date received', gbpTime()],
          ['Response due',  due + ' (30-day statutory limit)'],
        ])}
        ${callout('Under UK GDPR Article 12, we are legally required to respond within one calendar month. If the request is complex we may extend this by a further two months and will inform you.', 'ℹ️')}
        ${p("If you have questions about your request, reply to this email or contact privacy@flowen.digital.", true)}
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
    text: `Hi ${displayName},\n\nYou've had a few days with Flowen. How's it going?\n\nIf you haven't started your first session yet, now's a great time: ${SITE}/dashboard/practice\n\nReply to this email with any questions.\n\nThe Flowen Customer Success Team`,
    html: wrap({
      dept: 'customer',
      chipLabel: '3-DAY CHECK-IN',
      body: `
        ${h1(`How's it going, ${displayName}?`)}
        ${p("You've had a few days with Flowen — we wanted to check in and make sure you're finding your way around.")}
        ${p("Your dashboard tracks every session and your progress builds with each one. If you haven't started yet, Stage 1 — Breath Control is a great place to begin.")}
        ${btn('Open practice dashboard', `${SITE}/dashboard/practice`)}
        ${p("Reply to this email with any questions — we read every message.", true)}
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
    text: `Hi ${displayName},\n\nOne week in. Consistent practice over weeks and months is where the real gains happen — you're on the right track.\n\nThe Flowen Customer Success Team`,
    html: wrap({
      dept: 'customer',
      chipLabel: '7-DAY MILESTONE',
      chipColor: '#10b981',
      body: `
        ${h1(`One week in, ${displayName}.`)}
        ${p("You've been with Flowen for a week. The research is clear: consistent daily practice compounds over time. You're building habits that will lead to real, lasting change.")}
        ${btn('View my progress', `${SITE}/dashboard`)}
        ${p("Keep going — your clinician is reviewing your sessions and will update your plan as you progress.", true)}
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
    text: `Hi ${displayName},\n\nIt's been a while since your last session. Even 5 minutes a day makes a real difference. Your progress is saved.\n\nThe Flowen Customer Success Team`,
    html: wrap({
      dept: 'customer',
      chipLabel: 'WE MISS YOU',
      body: `
        ${h1(`Come back, ${displayName}.`)}
        ${p("It's been a while since your last session. Speech fluency practice works best when it's consistent — even five minutes a day maintains the progress you've already made.")}
        ${p("Your sessions, analytics, and clinician notes are all still there. Pick up exactly where you left off.")}
        ${btn('Resume my practice', `${SITE}/dashboard/practice`)}
        ${p("If you're having any issues or need help, reply to this email — we're here.", true)}
      `,
    }),
  });
}

// ── 16. Founding member offer ─────────────────────────────────────────────────

export async function sendFoundingOffer(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.hello,
    to:      email,
    subject: 'Founding member spot available — Flowen',
    replyTo: 'hello@flowen.digital',
    tags:    [{ name: 'type', value: 'founding_offer' }],
    text: `Hi ${displayName},\n\nWe're inviting a select group of waitlist members to join Flowen as Founding Members — locked-in pricing for life and direct access to the product team.\n\nThis is personal to you: ${SITE}/pricing\n\nThe Flowen Team`,
    html: wrap({
      dept: 'customer',
      chipLabel: 'FOUNDING MEMBER',
      chipColor: '#d97706',
      chipBg: '#1a1106',
      body: `
        ${h1(`A founding spot for you, ${displayName}.`)}
        ${p("We're inviting a select group of waitlist members to join Flowen as Founding Members — locked-in pricing for life, direct access to the product team, and early access to everything we build.")}
        ${p("<strong style=\"color:#f1f5f9;\">Founding Member spots are strictly limited.</strong> This invitation is personal to you.")}
        ${btn('Claim my founding spot', `${SITE}/pricing`, '#d97706')}
        ${callout('This offer expires when spots fill up. Reply to this email with any questions.', '⏳')}
      `,
    }),
  });
}

// ── 17. Trial ending ──────────────────────────────────────────────────────────

export async function sendUpgradeNudge(email: string, displayName: string) {
  await sendEmail({
    from:    FROM.billing,
    to:      email,
    subject: 'Your Flowen trial is ending soon',
    replyTo: 'billing@flowen.digital',
    tags:    [{ name: 'type', value: 'upgrade_nudge' }],
    text: `Hi ${displayName},\n\nYour Flowen trial is coming to an end. Upgrade to keep access to your practice sessions, analytics, and clinical support.\n\n${SITE}/pricing\n\nFlowen Billing`,
    html: wrap({
      dept: 'billing',
      chipLabel: 'TRIAL ENDING',
      chipColor: '#f59e0b',
      chipBg: '#1c1209',
      body: `
        ${h1(`Your trial is ending soon, ${displayName}.`)}
        ${p("Your Flowen trial is coming to an end. To keep uninterrupted access to your practice sessions, fluency analytics, and clinician messaging, upgrade to a full subscription.")}
        ${btn('See plans & pricing', `${SITE}/pricing`, '#f59e0b')}
        ${callout("Questions about which plan is right for you? Reply to this email or contact billing@flowen.digital.", '💬')}
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
    text: `Workflow: ${opts.workflowName}\nUser: ${opts.userName} <${opts.userEmail}>\nTime: ${gbpTime()}${opts.detail ? `\nDetail: ${opts.detail}` : ''}`,
    html: wrap({
      dept: 'internal',
      chipLabel: 'WORKFLOW ALERT',
      chipColor: '#f97316',
      body: `
        ${h1(opts.workflowName)}
        ${dataTable([
          ['User',  opts.userName],
          ['Email', opts.userEmail],
          ['Time',  gbpTime()],
          ...(opts.detail ? [['Detail', opts.detail] as [string, string]] : []),
        ])}
        ${btn('View admin panel', `${SITE}/admin`, '#f97316')}
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
  const label = eventLabels[opts.eventType] ?? opts.eventType;
  const isHighSeverity = ['suspicious_login', 'account_locked'].includes(opts.eventType);

  await sendEmail({
    from:    FROM.security,
    to:      opts.email,
    subject: `Security alert: ${label} — Flowen`,
    replyTo: 'security@flowen.digital',
    tags:    [{ name: 'type', value: 'security_alert' }],
    text: `Hi ${opts.displayName},\n\nSecurity alert: ${label}\n\nIf this wasn't you, contact security@flowen.digital immediately.\n\nFlowen Security Team`,
    html: wrap({
      dept: 'security',
      chipLabel: isHighSeverity ? 'URGENT SECURITY ALERT' : 'SECURITY NOTICE',
      chipColor: '#ef4444',
      chipBg: '#1c0f0f',
      body: `
        ${h1(label)}
        ${p(`Hi ${opts.displayName}, we detected the following security event on your Flowen account.`)}
        ${dataTable([
          ['Event',    label],
          ['Time',     gbpTime()],
          ...(opts.ip       ? [['IP address', opts.ip]       as [string, string]] : []),
          ...(opts.location ? [['Location',   opts.location] as [string, string]] : []),
          ...(opts.detail   ? [['Details',    opts.detail]   as [string, string]] : []),
        ])}
        ${isHighSeverity
          ? `${callout('<strong>If this was not you, contact security@flowen.digital immediately and change your password.</strong>', '🚨')}`
          : `${callout('If this was you, no action is needed. If you don\'t recognise this activity, contact security@flowen.digital.', '🔒')}`}
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
    text: `Hi ${opts.clinicianName},\n\nWeekly practice report for ${opts.patientName} (${opts.reportPeriod}).\n\nSessions: ${opts.sessionsCompleted}\nAvg. accuracy: ${opts.avgAccuracy}%\nTop technique: ${opts.topTechnique}\n\nNotes: ${opts.notes}\n\nView full report: ${opts.reportUrl}\n\nThe Flowen Clinical Team`,
    html: wrap({
      dept: 'clinical',
      chipLabel: 'CLINICAL REPORT',
      chipColor: '#14b8a6',
      chipBg: '#091a1a',
      body: `
        ${h1(`Patient report: ${opts.patientName}`)}
        ${p(`Hi ${opts.clinicianName}, here is the automated practice summary for ${opts.patientName} covering <strong style="color:#f1f5f9;">${opts.reportPeriod}</strong>.`)}
        ${dataTable([
          ['Sessions completed', String(opts.sessionsCompleted)],
          ['Average accuracy',   `${opts.avgAccuracy}%`],
          ['Top technique',      opts.topTechnique],
          ['Generated',          gbpTime()],
        ])}
        <div style="background:#060a10;border-radius:10px;padding:18px 20px;margin:16px 0;">
          <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:1px;font-family:monospace;">Clinical notes</p>
          <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${opts.notes}</p>
        </div>
        ${btn('View full report', opts.reportUrl, '#14b8a6')}
      `,
    }),
  });
}

// ── 21. Product update / changelog email ──────────────────────────────────────

export type ChangeType = 'new' | 'improved' | 'fixed' | 'security' | 'policy';

export interface ChangelogItem {
  type: ChangeType;
  title: string;
  description: string;
  href?: string;
  linkText?: string;
}

export interface ChangelogRelease {
  version: string;         // e.g. "1.2.0" or "August 2026"
  date: string;            // ISO date string
  summary: string;         // one-line overview shown at top
  items: ChangelogItem[];
}

const CHANGE_META: Record<ChangeType, { label: string; color: string; bg: string; icon: string }> = {
  new:      { label: 'NEW',      color: '#10b981', bg: '#022c22', icon: '✨' },
  improved: { label: 'IMPROVED', color: '#6366f1', bg: '#0f0e2a', icon: '🔧' },
  fixed:    { label: 'FIXED',    color: '#3b82f6', bg: '#0a1628', icon: '🐛' },
  security: { label: 'SECURITY', color: '#ef4444', bg: '#1c0f0f', icon: '🔐' },
  policy:   { label: 'POLICY',   color: '#8b5cf6', bg: '#130d21', icon: '📋' },
};

export function buildChangelogHtml(release: ChangelogRelease): string {
  const dateLabel = new Date(release.date).toLocaleDateString('en-GB', { dateStyle: 'long' });
  const grouped = new Map<ChangeType, ChangelogItem[]>();
  const order: ChangeType[] = ['security', 'policy', 'new', 'improved', 'fixed'];
  for (const type of order) grouped.set(type, []);
  for (const item of release.items) {
    grouped.get(item.type)!.push(item);
  }

  const sections = order
    .filter(t => grouped.get(t)!.length > 0)
    .map(type => {
      const meta = CHANGE_META[type];
      const items = grouped.get(type)!;
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px;">
          <tr>
            <td>
              <span style="display:inline-block;background:${meta.bg};color:${meta.color};border:1px solid ${meta.color}30;font-size:10px;font-weight:800;padding:3px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;font-family:monospace;">${meta.icon} ${meta.label}</span>
            </td>
          </tr>
        </table>
        ${items.map(item => `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0;background:#060a10;border-radius:10px;overflow:hidden;border-left:3px solid ${meta.color}40;">
            <tr>
              <td style="padding:14px 16px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${item.title}</p>
                <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${item.description}</p>
                ${item.href ? `<a href="${item.href}" style="display:inline-block;margin-top:8px;font-size:12px;color:${meta.color};text-decoration:none;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${item.linkText ?? 'View change'} →</a>` : ''}
              </td>
            </tr>
          </table>
        `).join('')}
      `;
    }).join('');

  return wrap({
    dept: 'product',
    chipLabel: `VERSION ${release.version}`,
    chipColor: '#6366f1',
    chipBg: '#0f0e2a',
    unsubscribeHref: `${SITE}/dashboard/settings`,
    body: `
      ${h1('What\'s new in Flowen')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
        <tr>
          <td>
            <span style="font-size:12px;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${dateLabel} · ${release.version}</span>
          </td>
        </tr>
      </table>
      ${p(release.summary)}
      ${sections}
      ${divider()}
      ${btn('See full changelog', `${SITE}/changelog`)}
      ${p("Questions about any of these changes? Reply to this email or contact updates@flowen.digital.", true)}
    `,
  });
}

export async function sendProductUpdate(opts: {
  to: string | string[];
  release: ChangelogRelease;
}): Promise<boolean> {
  const dateLabel = new Date(opts.release.date).toLocaleDateString('en-GB', { dateStyle: 'long' });
  const typeCount = new Set(opts.release.items.map(i => i.type)).size;
  const summary = `${opts.release.items.length} update${opts.release.items.length !== 1 ? 's' : ''} across ${typeCount} categor${typeCount !== 1 ? 'ies' : 'y'}`;

  return sendEmail({
    from:    FROM.updates,
    to:      opts.to,
    subject: `Flowen ${opts.release.version} — ${opts.release.summary}`,
    replyTo: 'updates@flowen.digital',
    tags:    [{ name: 'type', value: 'product_update' }],
    text: `Flowen ${opts.release.version} · ${dateLabel}\n\n${opts.release.summary}\n\n${opts.release.items.map(i => `[${i.type.toUpperCase()}] ${i.title}\n${i.description}${i.href ? `\n${i.href}` : ''}`).join('\n\n')}\n\nSee full changelog: ${SITE}/changelog`,
    html: buildChangelogHtml(opts.release),
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
    text: `${opts.headline}\n\n${opts.body}\n\nHoward · Flowen Founder & CEO\ninvestors@flowen.digital`,
    html: wrap({
      dept: 'investors',
      chipLabel: `INVESTOR UPDATE · ${opts.period}`,
      chipColor: '#d97706',
      chipBg: '#1a1106',
      body: `
        ${h1(opts.headline)}
        ${p(opts.body)}
        ${opts.metrics && opts.metrics.length > 0 ? dataTable(opts.metrics) : ''}
        ${opts.attachments ? callout(opts.attachments, '📎') : ''}
        ${btn('Investor portal', `${SITE}/admin/venture`, '#d97706')}
      `,
    }),
  });
}

// ── Deprecated alias ──────────────────────────────────────────────────────────

/** @deprecated use sendAdminWaitlistAlert */
export const sendWaitlistNotification = sendAdminWaitlistAlert;
