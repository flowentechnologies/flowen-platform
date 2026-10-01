import { safeRedirectPath } from '@/lib/auth/redirect-path';

/** Supabase allows 6-10 digits ("Email OTP Length" in Auth settings); accept the range so a settings change cannot lock users out. */
export const EMAIL_CODE_MIN_LENGTH = 6;
export const EMAIL_CODE_MAX_LENGTH = 10;

/** Strip spaces and dashes users add when copying a code from an email. */
export function normalizeEmailCode(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '') : '';
}

export function isValidEmailCode(code: string): boolean {
  return new RegExp(`^\\d{${EMAIL_CODE_MIN_LENGTH},${EMAIL_CODE_MAX_LENGTH}}$`).test(code);
}

export type VerifyCodeInput = { email: string; token: string; next: string };

/** Validate the verify-code request body. Returns null when it is unusable. */
export function parseVerifyCodeBody(body: unknown): VerifyCodeInput | null {
  if (!body || typeof body !== 'object') return null;
  const { email, token, next } = body as Record<string, unknown>;
  if (typeof email !== 'string') return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(cleanEmail)) return null;
  const cleanToken = normalizeEmailCode(token);
  if (!isValidEmailCode(cleanToken)) return null;
  return { email: cleanEmail, token: cleanToken, next: safeRedirectPath(next) };
}

/** CSRF guard for the cookie-setting POST: browsers always send Origin on same-origin fetch POSTs. */
export function isSameOrigin(originHeader: string | null, requestOrigin: string): boolean {
  return originHeader === requestOrigin;
}
