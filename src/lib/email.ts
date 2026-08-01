import nodemailer from 'nodemailer';

const FROM = '"Flowen" <flowenspeech@outlook.com>';
const ADMIN = 'flowenspeech@outlook.com';
const SITE  = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.flowen.digital';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_SERVER_HOST     ?? 'smtp.outlook.com',
    port:   parseInt(process.env.EMAIL_SERVER_PORT ?? '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_SERVER_USER     ?? 'flowenspeech@outlook.com',
      pass: process.env.EMAIL_SERVER_PASSWORD ?? '',
    },
  });
}

async function send(opts: nodemailer.SendMailOptions) {
  try {
    await createTransport().sendMail(opts);
  } catch (err) {
    console.error('[email] send error:', err);
  }
}

// ── HTML wrapper ──────────────────────────────────────────────────────────────

function wrap(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;max-width:100%;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #334155;">
            <a href="${SITE}" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
              <span style="width:28px;height:28px;background:#10b981;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#0f172a;font-size:14px;">F</span>
              <span style="font-weight:700;font-size:16px;color:#f8fafc;letter-spacing:-0.3px;">Flowen</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #334155;background:#0f172a;">
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
              Flowen Speech Technology Ltd &bull; UK Company &bull; ICO Registration pending<br>
              Questions? <a href="mailto:flowenspeech@outlook.com" style="color:#10b981;text-decoration:none;">flowenspeech@outlook.com</a>
              &bull; <a href="${SITE}/legal" style="color:#10b981;text-decoration:none;">Privacy Policy</a>
              &bull; <a href="${SITE}/legal" style="color:#10b981;text-decoration:none;">Terms</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:#10b981;color:#0f172a;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;margin-top:8px;">${text}</a>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:12px 0;font-size:15px;color:#94a3b8;line-height:1.65;">${text}</p>`;
}

function badge(text: string) {
  return `<span style="display:inline-block;background:#10b981;color:#0f172a;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;font-family:monospace;">${text}</span>`;
}

// ── Email senders ─────────────────────────────────────────────────────────────

/** Confirmation to the user who joined the waitlist */
export async function sendWaitlistConfirmation(email: string) {
  await send({
    from: FROM,
    to:   email,
    subject: "You're on the Flowen waitlist",
    text: `Thanks for joining the Flowen waitlist! We'll email you as soon as your spot is ready. In the meantime, visit ${SITE} to learn more.`,
    html: wrap(`
      ${badge('WAITLIST CONFIRMED')}
      ${h1("You're on the list.")}
      ${p("Thanks for joining — you're now on the Flowen waitlist. We'll send you an email the moment your access is ready.")}
      ${p("Flowen is a voice-based fluency practice platform for people who stutter, built with clinical input and designed for real therapeutic outcomes.")}
      ${btn('Learn more about Flowen', SITE)}
      ${p(`<span style="color:#64748b;font-size:13px;">If you didn't sign up for this, you can safely ignore this email.</span>`)}
    `),
  });
}

/** Admin alert for a new waitlist signup */
export async function sendAdminWaitlistAlert(lead: {
  email: string;
  fullName?: string;
  planTier?: string;
  organization?: string;
}) {
  await send({
    from: FROM,
    to:   ADMIN,
    subject: `New waitlist signup: ${lead.email}`,
    text: `New waitlist lead:\n\nEmail: ${lead.email}\nName: ${lead.fullName ?? 'N/A'}\nPlan: ${lead.planTier ?? 'N/A'}\nOrg: ${lead.organization ?? 'N/A'}\nTime: ${new Date().toISOString()}`,
    html: wrap(`
      ${badge('ADMIN ALERT')}
      ${h1('New waitlist signup')}
      <table style="margin-top:16px;width:100%;border-collapse:collapse;">
        ${[
          ['Email',        lead.email],
          ['Name',         lead.fullName    ?? '—'],
          ['Plan',         lead.planTier    ?? '—'],
          ['Organisation', lead.organization ?? '—'],
          ['Time',         new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (London)'],
        ].map(([k, v]) => `
          <tr>
            <td style="padding:8px 12px 8px 0;font-size:13px;color:#64748b;font-weight:600;white-space:nowrap;vertical-align:top;">${k}</td>
            <td style="padding:8px 0;font-size:14px;color:#f8fafc;">${v}</td>
          </tr>
        `).join('')}
      </table>
      ${btn('View Supabase dashboard', 'https://supabase.com/dashboard')}
    `),
  });
}

/** Welcome email sent after a user completes onboarding */
export async function sendWelcomeEmail(email: string, displayName: string) {
  await send({
    from: FROM,
    to:   email,
    subject: `Welcome to Flowen, ${displayName}`,
    text: `Hi ${displayName},\n\nYour Flowen account is set up and ready. Head to ${SITE}/dashboard to start your first practice session.\n\nIf you have questions, reply to this email.\n\nThe Flowen team`,
    html: wrap(`
      ${badge('WELCOME')}
      ${h1(`Hi ${displayName}, you're in.`)}
      ${p("Your Flowen account is set up and ready to go. Your practice dashboard gives you access to speech fluency exercises, session analytics, and personalised feedback.")}
      ${btn('Open my dashboard', `${SITE}/dashboard`)}
      ${p("If you have any questions or feedback, just reply to this email — we read every message.")}
      ${p(`<span style="color:#64748b;font-size:13px;">The Flowen team</span>`)}
    `),
  });
}

/** Admin notification when a new user completes onboarding */
export async function sendAdminNewUserAlert(email: string, displayName: string, role: string) {
  await send({
    from: FROM,
    to:   ADMIN,
    subject: `New user onboarded: ${displayName}`,
    text: `${displayName} (${email}) completed onboarding. Role: ${role}. Time: ${new Date().toISOString()}`,
    html: wrap(`
      ${badge('NEW USER')}
      ${h1('New user onboarded')}
      <table style="margin-top:16px;width:100%;border-collapse:collapse;">
        ${[
          ['Name',  displayName],
          ['Email', email],
          ['Role',  role],
          ['Time',  new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (London)'],
        ].map(([k, v]) => `
          <tr>
            <td style="padding:8px 12px 8px 0;font-size:13px;color:#64748b;font-weight:600;white-space:nowrap;">${k}</td>
            <td style="padding:8px 0;font-size:14px;color:#f8fafc;">${v}</td>
          </tr>
        `).join('')}
      </table>
    `),
  });
}

/** Payment confirmation to the subscriber */
export async function sendPaymentConfirmation(opts: {
  email: string;
  displayName: string;
  tier: string;
  cycle: string;
  amountPence: number;
  currency: string;
}) {
  const amount = (opts.amountPence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: opts.currency.toUpperCase(),
  });
  const tierLabel = opts.tier === 'founding' ? 'Founding Member' : opts.tier.charAt(0).toUpperCase() + opts.tier.slice(1);
  const cycleLabel = opts.cycle.replace('_', ' ');

  await send({
    from: FROM,
    to:   opts.email,
    subject: `Payment confirmed — Flowen ${tierLabel}`,
    text: `Hi ${opts.displayName},\n\nThank you for your payment of ${amount}. Your ${tierLabel} (${cycleLabel}) subscription is now active.\n\nAccess your dashboard at ${SITE}/dashboard.\n\nThe Flowen team`,
    html: wrap(`
      ${badge('PAYMENT CONFIRMED')}
      ${h1(`Thank you, ${opts.displayName}!`)}
      ${p(`Your payment of <strong style="color:#f8fafc;">${amount}</strong> has been processed and your <strong style="color:#10b981;">${tierLabel}</strong> subscription is now active.`)}
      <table style="margin:20px 0;width:100%;border-collapse:collapse;background:#0f172a;border-radius:10px;overflow:hidden;">
        ${[
          ['Plan',     `${tierLabel} (${cycleLabel})`],
          ['Amount',   amount],
          ['Status',   '✓ Active'],
        ].map(([k, v]) => `
          <tr>
            <td style="padding:12px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #1e293b;">${k}</td>
            <td style="padding:12px 16px;font-size:14px;color:#f8fafc;border-bottom:1px solid #1e293b;">${v}</td>
          </tr>
        `).join('')}
      </table>
      ${btn('Go to my dashboard', `${SITE}/dashboard`)}
      ${p(`<span style="color:#64748b;font-size:13px;">Keep this email as your payment record. To manage your subscription, visit account settings or email us.</span>`)}
    `),
  });
}

/** Admin alert when a payment succeeds (new subscriber) */
export async function sendAdminPaymentAlert(opts: {
  email: string;
  tier: string;
  cycle: string;
  amountPence: number;
  currency: string;
  stripeCustomerId: string;
}) {
  const amount = (opts.amountPence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: opts.currency.toUpperCase(),
  });
  await send({
    from: FROM,
    to:   ADMIN,
    subject: `New subscriber: ${opts.email} — ${amount}`,
    text: `New payment received.\n\nEmail: ${opts.email}\nTier: ${opts.tier}\nCycle: ${opts.cycle}\nAmount: ${amount}\nStripe customer: ${opts.stripeCustomerId}`,
    html: wrap(`
      ${badge('NEW SUBSCRIBER')}
      ${h1('Payment received')}
      <table style="margin-top:16px;width:100%;border-collapse:collapse;">
        ${[
          ['Email',           opts.email],
          ['Tier',            opts.tier],
          ['Cycle',           opts.cycle.replace('_', ' ')],
          ['Amount',          amount],
          ['Stripe customer', opts.stripeCustomerId],
          ['Time',            new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (London)'],
        ].map(([k, v]) => `
          <tr>
            <td style="padding:8px 12px 8px 0;font-size:13px;color:#64748b;font-weight:600;white-space:nowrap;">${k}</td>
            <td style="padding:8px 0;font-size:14px;color:#f8fafc;">${v}</td>
          </tr>
        `).join('')}
      </table>
    `),
  });
}

/** User notification when a subscription payment fails */
export async function sendPaymentFailedUser(email: string, displayName: string) {
  await send({
    from: FROM,
    to:   email,
    subject: 'Action required — Flowen payment failed',
    text: `Hi ${displayName},\n\nWe could not process your Flowen subscription payment. Please update your payment details to keep access. Visit ${SITE}/dashboard or contact us at flowenspeech@outlook.com.\n\nThe Flowen team`,
    html: wrap(`
      ${badge('ACTION REQUIRED')}
      ${h1('Payment failed')}
      ${p(`Hi ${displayName}, we weren't able to process your Flowen subscription payment.`)}
      ${p("Please update your payment details to keep your access. Stripe will retry automatically, but updating now avoids any interruption.")}
      ${btn('Update payment details', `${SITE}/dashboard/settings`)}
      ${p(`If you need help, reply to this email or contact <a href="mailto:flowenspeech@outlook.com" style="color:#10b981;">flowenspeech@outlook.com</a>.`)}
    `),
  });
}

/** Admin alert when any subscription payment fails */
export async function sendAdminPaymentFailedAlert(opts: {
  email: string;
  invoiceId: string;
  amountPence: number;
  currency: string;
  attemptCount: number;
}) {
  const amount = (opts.amountPence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: opts.currency.toUpperCase(),
  });
  await send({
    from: FROM,
    to:   ADMIN,
    subject: `Payment failed: ${opts.email} — attempt ${opts.attemptCount}`,
    text: `Payment failure.\n\nEmail: ${opts.email}\nInvoice: ${opts.invoiceId}\nAmount: ${amount}\nAttempts: ${opts.attemptCount}`,
    html: wrap(`
      ${badge('PAYMENT FAILED')}
      ${h1('Subscription payment failed')}
      <table style="margin-top:16px;width:100%;border-collapse:collapse;">
        ${[
          ['Email',         opts.email],
          ['Invoice ID',    opts.invoiceId],
          ['Amount due',    amount],
          ['Attempt',       String(opts.attemptCount)],
          ['Time',          new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ' (London)'],
        ].map(([k, v]) => `
          <tr>
            <td style="padding:8px 12px 8px 0;font-size:13px;color:#64748b;font-weight:600;white-space:nowrap;">${k}</td>
            <td style="padding:8px 0;font-size:14px;color:#f8fafc;">${v}</td>
          </tr>
        `).join('')}
      </table>
      ${btn('View in Stripe', 'https://dashboard.stripe.com/invoices')}
    `),
  });
}

/** Admin alert when a new support ticket is submitted */
export async function sendAdminSupportTicketAlert(opts: {
  userEmail: string;
  subject: string;
  body: string;
  category: string;
  ticketId: string;
  slaDueAt: string;
}) {
  const slaLabel = new Date(opts.slaDueAt).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  await send({
    from: FROM,
    to:   ADMIN,
    subject: `[Support] ${opts.category.toUpperCase()}: ${opts.subject}`,
    text: `New support ticket from ${opts.userEmail}.\n\nCategory: ${opts.category}\nSubject: ${opts.subject}\nSLA due: ${slaLabel}\n\n${opts.body}`,
    html: wrap(`
      ${badge('SUPPORT TICKET')}
      ${h1('New support request')}
      <table style="margin:16px 0;width:100%;border-collapse:collapse;">
        ${[
          ['From',     opts.userEmail],
          ['Category', opts.category],
          ['SLA due',  slaLabel],
          ['Ticket',   opts.ticketId],
        ].map(([k, v]) => `
          <tr>
            <td style="padding:8px 12px 8px 0;font-size:13px;color:#64748b;font-weight:600;white-space:nowrap;">${k}</td>
            <td style="padding:8px 0;font-size:14px;color:#f8fafc;">${v}</td>
          </tr>
        `).join('')}
      </table>
      <div style="background:#0f172a;border-radius:10px;padding:16px 20px;margin-top:4px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
        <p style="margin:0;font-size:14px;color:#cbd5e1;line-height:1.7;white-space:pre-wrap;">${opts.body.slice(0, 1000)}${opts.body.length > 1000 ? '…' : ''}</p>
      </div>
      ${btn('Reply to user', `mailto:${opts.userEmail}?subject=Re: ${encodeURIComponent(opts.subject)}`)}
    `),
  });
}

/** @deprecated use sendAdminWaitlistAlert */
export const sendWaitlistNotification = sendAdminWaitlistAlert;
