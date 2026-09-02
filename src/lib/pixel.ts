/**
 * Client-side Meta Pixel + Snapchat Pixel wrapper.
 *
 * Each exported function:
 *   1. Fires the browser-side fbq() call with a stable event_id UUID
 *   2. Fires the browser-side snaptr() call for the equivalent Snap event
 *      (where one exists — see SNAP_EVENT_MAP)
 *   3. Fire-and-forgets the same event to /api/track/capi with the same
 *      event_id, which relays it server-side to both Meta CAPI and Snap CAPI
 *
 * Both platforms deduplicate on event_id — if the browser pixel and the CAPI
 * relay report the same event, only one is counted. This gives ad-blocker
 * resilience and a higher Event Match Quality score without double-counting.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'InitiateCheckout'
  | 'Purchase'
  | 'StartTrial'
  | 'CompleteRegistration'
  | 'Subscribe';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    snaptr?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function fbq(...args: unknown[]): void {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

function snaptr(...args: unknown[]): void {
  if (typeof window !== 'undefined' && typeof window.snaptr === 'function') {
    window.snaptr(...args);
  }
}

/**
 * Meta event name → Snap Pixel standard event name.
 * Only events with a clean Snap equivalent are mapped; 'Lead' has no
 * matching Snap standard event and is intentionally left browser/Meta-only
 * rather than forced onto a mismatched Snap category.
 */
const SNAP_EVENT_MAP: Partial<Record<MetaEventName, string>> = {
  PageView:             'PAGE_VIEW',
  ViewContent:          'VIEW_CONTENT',
  InitiateCheckout:     'ADD_CART',
  Purchase:             'PURCHASE',
  StartTrial:           'START_TRIAL',
  CompleteRegistration: 'SIGN_UP',
  Subscribe:            'SUBSCRIBE',
};

function fireSnap(eventName: MetaEventName, opts?: Record<string, unknown>): void {
  const snapEventName = SNAP_EVENT_MAP[eventName];
  if (snapEventName) {
    snaptr('track', snapEventName, opts ?? {});
  }
}

/** RFC 4122 v4 UUID — works in all modern browsers and Node ≥ 14.17 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: Math.random-based UUID (pre-Node 19 edge runtime)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Fire-and-forget CAPI bridge.
 * Never throws — CAPI failure should never affect the user's journey.
 */
function capi(
  event_name:   MetaEventName,
  event_id:     string,
  custom_data?: Record<string, unknown>,
): void {
  fetch('/api/track/capi', {
    method:    'POST',
    headers:   { 'Content-Type': 'application/json' },
    body:      JSON.stringify({ event_name, event_id, custom_data }),
    keepalive: true,
  }).catch(() => { /* intentionally silent */ });
}

// ── Standard events ───────────────────────────────────────────────────────────

export function pixelPageView(): void {
  const id = uuid();
  fbq('track', 'PageView', {}, { eventID: id });
  fireSnap('PageView');
  capi('PageView', id);
}

export function pixelLead(opts?: { content_name?: string; content_category?: string }): void {
  const id = uuid();
  fbq('track', 'Lead', opts ?? {}, { eventID: id });
  capi('Lead', id, opts);
}

export function pixelCompleteRegistration(opts?: { content_name?: string; status?: boolean }): void {
  const id = uuid();
  fbq('track', 'CompleteRegistration', opts ?? {}, { eventID: id });
  fireSnap('CompleteRegistration', opts as Record<string, unknown>);
  capi('CompleteRegistration', id, opts as Record<string, unknown>);
}

export function pixelViewContent(opts?: {
  content_name?:     string;
  content_category?: string;
  content_ids?:      string[];
  value?:            number;
  currency?:         string;
}): void {
  const id = uuid();
  fbq('track', 'ViewContent', opts ?? {}, { eventID: id });
  fireSnap('ViewContent', opts);
  capi('ViewContent', id, opts);
}

export function pixelInitiateCheckout(opts?: {
  content_ids?: string[];
  num_items?:   number;
  value?:       number;
  currency?:    string;
}): void {
  const id = uuid();
  fbq('track', 'InitiateCheckout', opts ?? {}, { eventID: id });
  fireSnap('InitiateCheckout', opts);
  capi('InitiateCheckout', id, opts);
}

export function pixelPurchase(opts: { value: number; currency: string; content_ids?: string[] }): void {
  const id = uuid();
  fbq('track', 'Purchase', opts, { eventID: id });
  fireSnap('Purchase', opts);
  capi('Purchase', id, opts);
}

export function pixelStartTrial(opts?: { value?: number; currency?: string; predicted_ltv?: number }): void {
  const id = uuid();
  fbq('track', 'StartTrial', opts ?? {}, { eventID: id });
  fireSnap('StartTrial', opts);
  capi('StartTrial', id, opts);
}

export function pixelSubscribe(opts?: { value?: number; currency?: string; predicted_ltv?: number }): void {
  const id = uuid();
  fbq('track', 'Subscribe', opts ?? {}, { eventID: id });
  fireSnap('Subscribe', opts);
  capi('Subscribe', id, opts);
}

export function pixelSearch(opts?: { search_string?: string }): void {
  const id = uuid();
  fbq('track', 'Search', opts ?? {}, { eventID: id });
  // Search not included in MetaEventName — browser-only is fine
}

export function pixelCustom(eventName: string, opts?: Record<string, unknown>): void {
  const id = uuid();
  fbq('trackCustom', eventName, opts ?? {}, { eventID: id });
  // Custom events go browser-only
}
