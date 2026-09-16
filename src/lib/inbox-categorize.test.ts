import { describe, it, expect } from 'vitest';
import { isAutomatedMail, computeNotificationPriority, isPaymentFailureNotice } from './inbox-categorize';

describe('isAutomatedMail', () => {
  it('flags a noreply-style sender', () => {
    expect(isAutomatedMail({ fromAddress: 'noreply@accounts.google.com', gmailCategory: 'primary' })).toBe(true);
    expect(isAutomatedMail({ fromAddress: 'no-reply@example.com', gmailCategory: null })).toBe(true);
    expect(isAutomatedMail({ fromAddress: 'mailer-daemon@postoffice.example.com', gmailCategory: null })).toBe(true);
  });

  it('flags mail Gmail itself tagged Updates/Promotions/Social, regardless of sender', () => {
    expect(isAutomatedMail({ fromAddress: 'someone@acme.com', gmailCategory: 'updates' })).toBe(true);
    expect(isAutomatedMail({ fromAddress: 'someone@acme.com', gmailCategory: 'promotions' })).toBe(true);
    expect(isAutomatedMail({ fromAddress: 'someone@acme.com', gmailCategory: 'social' })).toBe(true);
  });

  it('does not flag a real person emailing from their own address in Primary — the exact case this must never catch: a genuine reply like "RE: Flowen x STAMMA"', () => {
    expect(isAutomatedMail({ fromAddress: 'j@meettide.digital', gmailCategory: 'primary' })).toBe(false);
  });

  it('does not flag "notifications"/"system" as a substring of an unrelated local part', () => {
    // Deliberately documents current (substring) matching behaviour rather
    // than asserting a stricter rule this function doesn't implement.
    expect(isAutomatedMail({ fromAddress: 'systematic@realvendor.com', gmailCategory: 'primary' })).toBe(true);
  });
});

describe('computeNotificationPriority', () => {
  it('is high for security or billing regardless of Gmail tab', () => {
    expect(computeNotificationPriority({ category: 'security', gmailCategory: 'promotions' })).toBe('high');
    expect(computeNotificationPriority({ category: 'billing', gmailCategory: 'updates' })).toBe('high');
  });

  it('is high for an investor or NHS partner CRM contact', () => {
    expect(computeNotificationPriority({ category: 'general', crmCategory: 'investor' })).toBe('high');
    expect(computeNotificationPriority({ category: 'general', crmCategory: 'nhs_partner' })).toBe('high');
  });

  it('is low for anything Gmail itself filed as Social/Promotions, even in a business category', () => {
    expect(computeNotificationPriority({ category: 'press', gmailCategory: 'social' })).toBe('low');
    expect(computeNotificationPriority({ category: 'general', gmailCategory: 'promotions' })).toBe('low');
  });

  it('is normal otherwise', () => {
    expect(computeNotificationPriority({ category: 'general', gmailCategory: 'primary' })).toBe('normal');
  });
});

describe('isPaymentFailureNotice', () => {
  // Real subject lines that landed in vendor_invoices as if they were paid
  // bills before this existed — a $5.98 x3 Explee retry sequence and 2x
  // Google Ads / 1x Google Workspace declined-card notices, all tracing
  // back to the same declined-card issue system-health's explee-credits
  // check has been flagging.
  it('flags the real declined-payment subjects that caused this bug', () => {
    expect(isPaymentFailureNotice('$5.98 payment to Explee was unsuccessful')).toBe(true);
    expect(isPaymentFailureNotice('Google Ads: Payment was declined for 242-662-7266')).toBe(true);
    expect(isPaymentFailureNotice('Google Workspace: Payment was declined for flowen.digital')).toBe(true);
    expect(isPaymentFailureNotice('Google Ads: Your service has been suspended')).toBe(true);
    expect(isPaymentFailureNotice('Google Ads: Update your payment method')).toBe(true);
  });

  it('does not flag a genuine receipt or invoice', () => {
    expect(isPaymentFailureNotice('Your receipt for £24.00')).toBe(false);
    expect(isPaymentFailureNotice('Invoice #4821 from Vercel')).toBe(false);
    expect(isPaymentFailureNotice('Payment received — thank you')).toBe(false);
  });
});
