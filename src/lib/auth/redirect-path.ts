/** Keep post-login destinations on this origin, without auth redirect loops. */
export function safeRedirectPath(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://flowen.invalid');
    if (url.origin !== 'https://flowen.invalid') return fallback;
    if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

/** Recovery must precede role/onboarding redirects after the PKCE exchange. */
export function isPasswordRecoveryPath(value: string | null): boolean {
  return value === '/auth/reset-password';
}
