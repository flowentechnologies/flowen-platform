'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { pixelPageView } from '@/lib/pixel';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === prevPath.current) return;

    const isFirstView = prevPath.current === null;
    prevPath.current = pathname;

    // Internal analytics
    fetch('/api/track/pageview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        path:     pathname,
        referrer: isFirstView && document.referrer ? document.referrer : undefined,
      }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ });

    // Re-fire tracking pixels on SPA navigation (skips first load — base codes handle that)
    if (!isFirstView) {
      pixelPageView(); // Facebook Pixel
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', { page_path: pathname });
      }
    }
  }, [pathname]);

  return null;
}
