'use client';

import { useEffect } from 'react';

export interface TrackingProvider {
  provider_key: string;
  head_html: string | null;
  body_html: string | null;
  consent_required: boolean;
  enabled: boolean;
}

function hasConsent(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('flowen_cookie_consent=all');
}

/**
 * Google Consent Mode v2 — pushed straight onto the dataLayer so it applies
 * whether GA4/gtag loads directly or through GTM. Signals start DENIED:
 * nothing here marks Google storage consented by default. The granted update
 * fires only after an explicit 'all' decision.
 */
function gtagConsent(command: 'default' | 'update', granted: boolean) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  const state = granted ? 'granted' : 'denied';
  w.dataLayer.push(['consent', command, {
    ad_storage:        state,
    analytics_storage: state,
    ad_user_data:      state,
    ad_personalization: state,
  }]);
}

const injected = new Set<string>();

function injectProvider(p: TrackingProvider) {
  if (injected.has(p.provider_key)) return;
  injected.add(p.provider_key);

  if (p.head_html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = p.head_html;
    tmp.querySelectorAll('script').forEach(old => {
      const s = document.createElement('script');
      for (const attr of old.attributes) s.setAttribute(attr.name, attr.value);
      s.textContent = old.textContent;
      document.head.appendChild(s);
    });
    tmp.querySelectorAll('link, meta').forEach(el =>
      document.head.appendChild(el.cloneNode(true))
    );
  }

  if (p.body_html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = p.body_html;
    if (tmp.firstChild) document.body.insertBefore(tmp.firstChild, document.body.firstChild);
  }
}

export default function TrackingScripts({ providers }: { providers: TrackingProvider[] }) {
  useEffect(() => {
    // Denied-by-default before anything injects — every page load, even
    // before the visitor has answered the banner.
    gtagConsent('default', false);

    const fire = () => {
      const consented = hasConsent();
      if (consented) gtagConsent('update', true);
      providers.forEach(p => {
        if (!p.enabled || !p.head_html) return;
        if (p.consent_required && !consented) return;
        injectProvider(p);
      });
    };

    fire();

    window.addEventListener('flowen:consent:granted', fire);
    return () => window.removeEventListener('flowen:consent:granted', fire);
  }, [providers]);

  return null;
}
