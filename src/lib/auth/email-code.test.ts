import { describe, it, expect } from 'vitest';
import { normalizeEmailCode, isValidEmailCode, parseVerifyCodeBody, isSameOrigin } from './email-code';

describe('email code', () => {
  it('strips spaces and dashes', () => expect(normalizeEmailCode(' 123 456 ')).toBe('123456'));
  it('normalises non-strings to empty', () => expect(normalizeEmailCode(undefined)).toBe(''));
  it.each(['123456', '000000', '53701709', '1234567890'])('accepts %s', c => expect(isValidEmailCode(c)).toBe(true));
  it.each(['', '12345', '12345678901', 'abcdef', '12 3456', '123456\n'])('rejects %j', c => expect(isValidEmailCode(c)).toBe(false));
});

describe('parseVerifyCodeBody', () => {
  it('accepts a valid body and lowercases the email', () => {
    expect(parseVerifyCodeBody({ email: ' Me@Example.com ', token: '123 456', next: '/dashboard/history?w=2' }))
      .toEqual({ email: 'me@example.com', token: '123456', next: '/dashboard/history?w=2' });
  });
  it('falls back to /dashboard for unsafe next', () => {
    expect(parseVerifyCodeBody({ email: 'a@b.co', token: '123456', next: 'https://evil.invalid' })?.next).toBe('/dashboard');
    expect(parseVerifyCodeBody({ email: 'a@b.co', token: '123456', next: '/auth/login' })?.next).toBe('/dashboard');
    expect(parseVerifyCodeBody({ email: 'a@b.co', token: '123456' })?.next).toBe('/dashboard');
  });
  it.each([null, 'x', {}, { email: 'nope', token: '123456' }, { email: 'a@b.co', token: '12' }, { email: 'a@b.co', token: '12345678901' }, { email: 5, token: '123456' }])('rejects %j', b => {
    expect(parseVerifyCodeBody(b)).toBeNull();
  });
});

describe('isSameOrigin', () => {
  it('requires an exact Origin match', () => {
    expect(isSameOrigin('https://www.flowen.digital', 'https://www.flowen.digital')).toBe(true);
    expect(isSameOrigin('https://evil.invalid', 'https://www.flowen.digital')).toBe(false);
    expect(isSameOrigin(null, 'https://www.flowen.digital')).toBe(false);
  });
});
