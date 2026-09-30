import { describe, it, expect } from 'vitest';
import { safeRedirectPath, isPasswordRecoveryPath } from './redirect-path';

describe('safeRedirectPath', () => {
  it('keeps an internal destination including its query and fragment', () => {
    expect(safeRedirectPath('/dashboard/history?week=2#session')).toBe('/dashboard/history?week=2#session');
  });
  it.each([undefined, '', 'https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/dashboard\n', '/auth/login', '/auth/callback?code=x', '/dashboard/../auth/login'])('rejects unsafe or looping destination %s', value => {
    expect(safeRedirectPath(value)).toBe('/dashboard');
  });
  it('allows a caller fallback', () => expect(safeRedirectPath(null, '')).toBe(''));
});
describe('password recovery destination', () => {
  it('allows only the exact reset page as a recovery exception', () => {
    expect(isPasswordRecoveryPath('/auth/reset-password')).toBe(true);
    expect(isPasswordRecoveryPath('/auth/reset-password/elsewhere')).toBe(false);
    expect(isPasswordRecoveryPath('//evil.invalid')).toBe(false);
    expect(isPasswordRecoveryPath(null)).toBe(false);
  });
});
