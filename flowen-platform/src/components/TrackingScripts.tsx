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
    const fire = () => {
      const consented = hasConsent();
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
