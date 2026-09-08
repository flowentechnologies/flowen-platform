'use client';

import { useEffect } from 'react';
import type { PurchaseEventPayload } from '@/lib/analytics/purchase-event';

function hasConsent(): boolean {
  return document.cookie.includes('flowen_cookie_consent=all');
}

/**
 * Fires the GA4 ecommerce `purchase` event on mount, using gtag() directly
 * (not a raw dataLayer.push) — gtag() itself does `dataLayer.push(arguments)`
 * (see src/lib/tracking-scripts.ts's generateGa4), so this is picked up
 * identically by the direct gtag.js GA4 property AND by GTM, since both
 * read from the same window.dataLayer.
 *
 * Same consent gate every other tracker in this app goes through
 * (TrackingScripts.tsx) — never fires before the cookie banner is accepted,
 * and listens for the same 'flowen:consent:granted' event so accepting
 * consent right after landing on this page still fires it once.
 *
 * Deduplicated per transaction via sessionStorage — reloading this page
 * (e.g. a bookmark, a browser back/forward) must not re-report the same
 * purchase. This is a best-effort, same-browser-tab guard; it can't prevent
 * every possible double-count (a cleared storage, a different device), but
 * neither can any client-only ecommerce tracking implementation.
 */
export function PurchaseEventTracker({ payload }: { payload: PurchaseEventPayload }) {
  useEffect(() => {
    const dedupeKey = `flowen_purchase_tracked_${payload.transaction_id}`;
    let fired = false;

    function fire() {
      if (fired || hasConsent() === false) return;
      try {
        if (sessionStorage.getItem(dedupeKey)) { fired = true; return; }
        sessionStorage.setItem(dedupeKey, '1');
      } catch {
        // sessionStorage unavailable — fire anyway rather than silently
        // dropping a real conversion; worst case is an occasional duplicate.
      }
      fired = true;

      const w = window as unknown as { dataLayer?: unknown[] };
      w.dataLayer = w.dataLayer || [];
      function gtag(...args: unknown[]) { w.dataLayer!.push(args); }

      gtag('event', 'purchase', {
        transaction_id: payload.transaction_id,
        value:          payload.value,
        currency:       payload.currency,
        items:          payload.items,
      });
    }

    fire();
    window.addEventListener('flowen:consent:granted', fire);
    return () => window.removeEventListener('flowen:consent:granted', fire);
  }, [payload]);

  return null;
}
