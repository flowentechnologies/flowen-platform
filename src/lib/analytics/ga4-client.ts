/** Consented GA4 queue and real browser identifiers. Never create a fake client ID. */
export function hasAnalyticsConsent(): boolean {
  return typeof document !== 'undefined' && /(?:^|;\s*)flowen_cookie_consent=all(?:;|$)/.test(document.cookie);
}

export function queueGa4Event(name: string, params: Record<string, unknown> = {}): boolean {
  if (!hasAnalyticsConsent()) return false;
  window.dataLayer = window.dataLayer || [];
  // gtag's documented queue uses Arguments, not a plain event object.
  function gtag(..._args: unknown[]) { window.dataLayer!.push(arguments); }
  gtag('event', name, params);
  return true;
}

export function captureGa4Identity(measurementId: string): void {
  if (!hasAnalyticsConsent() || typeof window.gtag !== 'function') return;
  const get = (field: string) => new Promise<unknown>(resolve => {
    const timeout = window.setTimeout(() => resolve(null), 5000);
    window.gtag!('get', measurementId, field, (value: unknown) => {
      window.clearTimeout(timeout); resolve(value);
    });
  });
  void Promise.all([get('client_id'), get('session_id')]).then(([clientId, sessionId]) => {
    if (!hasAnalyticsConsent() || typeof clientId !== 'string' || !clientId) return;
    return fetch('/api/track/ga4-identity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ measurementId, clientId, sessionId: String(sessionId ?? '') }),
    });
  }).catch(() => { /* no identity means server purchase fails closed */ });
}
