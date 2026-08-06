import { NextResponse } from 'next/server';
import {
  sendWaitlistConfirmation,
  sendAdminWaitlistAlert,
  sendWaitlistInvite,
  sendWelcomeEmail,
  sendAdminNewUserAlert,
  sendPaymentConfirmation,
  sendAdminPaymentAlert,
  sendPaymentFailedUser,
  sendAdminPaymentFailedAlert,
  sendAdminSupportTicketAlert,
  sendSupportTicketConfirmation,
  sendGdprRequestConfirmation,
  sendCheckIn3d,
  sendMilestone7d,
  sendReEngagement,
  sendFoundingOffer,
  sendUpgradeNudge,
  sendAdminWorkflowAlert,
  sendSecurityAlert,
  sendClinicalReport,
  sendProductUpdate,
  sendInvestorUpdate,
} from '@/lib/email';

// Temporary one-shot route — delete after use
export async function POST(req: Request) {
  const { to } = await req.json().catch(() => ({ to: null }));
  if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 });

  const now   = new Date().toISOString();
  const inOneWeek = new Date(Date.now() + 7 * 86400_000).toISOString();
  const name  = 'Howard';
  const results: Record<string, boolean> = {};

  const run = async (key: string, fn: () => Promise<unknown>) => {
    try { await fn(); results[key] = true; }
    catch (e) { console.error(`[test-email] ${key}:`, e); results[key] = false; }
  };

  await run('01_waitlist_confirmation',   () => sendWaitlistConfirmation(to));
  await run('02_admin_waitlist_alert',    () => sendAdminWaitlistAlert({ email: to, fullName: name, planTier: 'Founding Member', organization: 'Self' }));
  await run('03_waitlist_invite',         () => sendWaitlistInvite({ email: to, inviteUrl: 'https://flowen.digital/invite/test-token', expiresAt: inOneWeek }));
  await run('04_welcome',                 () => sendWelcomeEmail(to, name));
  await run('05_admin_new_user',          () => sendAdminNewUserAlert(to, name, 'user'));
  await run('06_payment_confirmation',    () => sendPaymentConfirmation({ email: to, displayName: name, tier: 'founding', cycle: 'yearly', amountPence: 23952, currency: 'gbp' }));
  await run('07_admin_payment_alert',     () => sendAdminPaymentAlert({ email: to, tier: 'founding', cycle: 'yearly', amountPence: 23952, currency: 'gbp', stripeCustomerId: 'cus_test123' }));
  await run('08_payment_failed_user',     () => sendPaymentFailedUser(to, name));
  await run('09_admin_payment_failed',    () => sendAdminPaymentFailedAlert({ email: to, invoiceId: 'in_test123', amountPence: 23952, currency: 'gbp', attemptCount: 1 }));
  await run('10_admin_support_ticket',    () => sendAdminSupportTicketAlert({ userEmail: to, subject: 'Cannot access my dashboard', body: "I've been trying to log in for the past hour but I keep getting redirected to the login page after entering my credentials. I've tried two different browsers. My account email is the same as this one.", category: 'access', ticketId: 'TKT-0042', slaDueAt: inOneWeek }));
  await run('11_support_confirmation',    () => sendSupportTicketConfirmation({ email: to, displayName: name, subject: 'Cannot access my dashboard', ticketId: 'TKT-0042', slaDueAt: inOneWeek }));
  await run('12_gdpr_confirmation',       () => sendGdprRequestConfirmation({ email: to, displayName: name, requestType: 'access', requestId: 'GDPR-2026-0041' }));
  await run('13_checkin_3d',             () => sendCheckIn3d(to, name));
  await run('14_milestone_7d',           () => sendMilestone7d(to, name));
  await run('15_re_engagement',          () => sendReEngagement(to, name));
  await run('16_founding_offer',         () => sendFoundingOffer(to, name));
  await run('17_upgrade_nudge',          () => sendUpgradeNudge(to, name));
  await run('18_admin_workflow_alert',   () => sendAdminWorkflowAlert({ workflowName: 'Payment retry — day 3', userEmail: to, userName: name, detail: 'Third automatic retry scheduled' }));
  await run('19_security_alert_low',     () => sendSecurityAlert({ email: to, displayName: name, eventType: 'new_device', ip: '82.45.120.9', location: 'London, UK' }));
  await run('20_security_alert_high',    () => sendSecurityAlert({ email: to, displayName: name, eventType: 'suspicious_login', ip: '195.22.10.44', location: 'Unknown', detail: 'Sign-in attempt from unrecognised IP' }));
  await run('21_clinical_report',        () => sendClinicalReport({ clinicianEmail: to, clinicianName: name, patientName: 'Sarah T.', reportPeriod: 'Week of 28 Jul 2026', sessionsCompleted: 6, avgAccuracy: 84, topTechnique: 'Prolonged speech', notes: 'Good consistency this week. Accuracy on Stage 3 (Rhythm Modelling) has improved from 71% to 84%. Recommend introducing Stage 4 exercises alongside current programme.', reportUrl: 'https://flowen.digital/admin' }));
  await run('22_product_update',         () => sendProductUpdate({ to, release: { version: '2.4.0', date: now, summary: 'Smoother session flow, new analytics, and a fix for mobile audio on iOS 18', items: [{ type: 'new', title: 'Session streak tracking', description: 'Your dashboard now shows your current and longest practice streaks. Consistency is everything.' }, { type: 'new', title: 'Stage 4 — Rhythm Modelling', description: 'The fourth practice stage is live. Builds on Stage 3 with real-time rhythm feedback.' }, { type: 'improved', title: 'Faster session load times', description: 'Audio assets now preload in the background. Sessions start in under a second on a good connection.' }, { type: 'fixed', title: 'iOS 18 microphone issue', description: 'Fixed a WebKit bug that caused audio capture to fail silently on iOS 18.2 and later.' }, { type: 'security', title: 'Session token rotation', description: 'Auth tokens now rotate on every login. No action needed from users.' }] } }));
  await run('23_investor_update',        () => sendInvestorUpdate({ to, subject: 'Flowen — July 2026 Investor Update', period: 'July 2026', headline: 'First paying customers, checkout live, 22 on waitlist', body: 'Stripe checkout went live this week. We have our first three Founding Member subscribers. The waitlist has grown to 22 confirmed signups since we opened the page six days ago.\n\nFull dashboard metrics and financial detail below.', metrics: [['MRR', '£179.76'], ['Founding Members', '3'], ['Waitlist', '22'], ['CAC', '£0 (organic)'], ['Runway', '14 months']] }));

  const total   = Object.keys(results).length;
  const success = Object.values(results).filter(Boolean).length;
  const failed  = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);

  return NextResponse.json({ sent: success, total, failed, results });
}
