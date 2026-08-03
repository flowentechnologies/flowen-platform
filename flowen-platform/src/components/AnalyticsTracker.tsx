'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (pathname === prevPath.current) return;

    const isFirstView = prevPath.current === null;
    prevPath.current = pathname;

    fetch('/api/track/pageview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        path:     pathname,
        referrer: isFirstView && document.referrer ? document.referrer : undefined,
      }),
      keepalive: true,
    }).catch(() => { /* fire-and-forget */ });
  }, [pathname]);

  return null;
}
