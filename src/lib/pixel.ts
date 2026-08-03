// Safe wrapper around window.fbq — no-ops if pixel hasn't loaded or consent was declined.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

function fbq(...args: unknown[]): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

// ── Standard events ───────────────────────────────────────────────────────────

export function pixelPageView(): void {
  fbq('track', 'PageView');
}

export function pixelLead(opts?: { content_name?: string; content_category?: string }): void {
  fbq('track', 'Lead', opts ?? {});
}

export function pixelCompleteRegistration(opts?: { content_name?: string; status?: boolean }): void {
  fbq('track', 'CompleteRegistration', opts ?? {});
}

export function pixelViewContent(opts?: {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  value?: number;
  currency?: string;
}): void {
  fbq('track', 'ViewContent', opts ?? {});
}

export function pixelInitiateCheckout(opts?: {
  content_ids?: string[];
  num_items?: number;
  value?: number;
  currency?: string;
}): void {
  fbq('track', 'InitiateCheckout', opts ?? {});
}

export function pixelPurchase(opts: { value: number; currency: string; content_ids?: string[] }): void {
  fbq('track', 'Purchase', opts);
}

export function pixelSearch(opts?: { search_string?: string }): void {
  fbq('track', 'Search', opts ?? {});
}

export function pixelCustom(eventName: string, opts?: Record<string, unknown>): void {
  fbq('trackCustom', eventName, opts ?? {});
}
