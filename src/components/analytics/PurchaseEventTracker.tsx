'use client';

import { useEffect } from 'react';
import { pixelStartTrial } from '@/lib/pixel';
import { queueGa4Event } from '@/lib/analytics/ga4-client';
import type { StartTrialEventPayload } from '@/lib/analytics/purchase-event';

function hasConsent(): boolean {
  return document.cookie.includes('flowen_cookie_consent=all');
}

/**
 * Fires the GA4 `start_trial` event on mount, using gtag() directly (not a
 * raw dataLayer.push) — gtag() itself does `dataLayer.push(arguments)`
 * (see src/lib/tracking-scripts.ts's generateGa4), so this is picked up
 * identically by the direct gtag.js GA4 property AND by GTM, since both
 * read from the same window.dataLayer.
 *
 * Renamed from `purchase` to `start_trial` on 2026-09-29: checkout always
 * starts a £0 trial, and reporting the recurring plan price as a purchase
 * fed ad platforms a false revenue signal. This event must never be mapped
 * to a paid-purchase bidding goal.
 *
 * Same consent gate every other tracker in this app goes through
 * (TrackingScripts.tsx) — never fires before the cookie banner is accepted,
 * and listens for the same 'flowen:consent:granted' event so accepting
 * consent right after landing on this page still fires it once.
 *
 * Deduplicated per transaction via sessionStorage — reloading this page
 * (e.g. a bookmark, a browser back/forward) must not re-report the same
 * trial start. This is a best-effort, same-browser-tab guard; it can't
 * prevent every possible double-count (a cleared storage, a different
 * device), but neither can any client-only ecommerce tracking
 * implementation.
 */
export function PurchaseEventTracker({ payload }: { payload: StartTrialEventPayload }) {
  useEffect(() => {
    const dedupeKey = `flowen_trial_tracked_${payload.transaction_id}`;
    let fired = false;

    function fire() {
      if (fired || hasConsent() === false || typeof window.gtag !== 'function') return;
      try {
        if (sessionStorage.getItem(dedupeKey)) { fired = true; return; }
      } catch {
        // sessionStorage unavailable — fire anyway rather than silently
        // dropping a real conversion; worst case is an occasional duplicate.
      }

      // Only the verified checkout session produces a trial event. Both Meta
      // paths share the transaction ID, including across browser tabs.
      pixelStartTrial({ value: 0, currency: payload.currency }, `trial:${payload.transaction_id}`);
      queueGa4Event('start_trial', {
        transaction_id: payload.transaction_id,
        value:          payload.value,
        currency:       payload.currency,
        items:          payload.items,
      });
      fired = true;
      try { sessionStorage.setItem(dedupeKey, '1'); } catch { /* best effort */ }
    }

    fire();
    window.addEventListener('flowen:consent:granted', fire);
    window.addEventListener('flowen:tracking:ready', fire);
    return () => {
      window.removeEventListener('flowen:consent:granted', fire);
      window.removeEventListener('flowen:tracking:ready', fire);
    };
  }, [payload]);

  return null;
}
