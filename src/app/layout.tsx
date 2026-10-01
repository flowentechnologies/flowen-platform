import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';
import TrackingScripts from '@/components/TrackingScripts';
import type { TrackingProvider } from '@/components/TrackingScripts';
import { JsonLd } from '@/components/JsonLd';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import PostHogProvider from '@/components/PostHogProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ImageLightbox } from '@/components/ImageLightbox';
import { adminDb as db } from '@/lib/supabase/admin';

// Inline script evaluated synchronously before first paint — prevents flash of
// unstyled (wrong-theme) content. Reads localStorage and applies the `dark`
// class to <html> before React hydrates so there is never a visible flicker.
const FOUC_SCRIPT = `(function(){try{var t=localStorage.getItem('flowen-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: 'Flowen | Speech practice',
  description: 'Browser-based speech practice with guided exercises, live acoustic feedback and session history.',
  metadataBase: new URL('https://flowen.digital'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Flowen | Speech practice',
    description: 'Guided speech practice, live acoustic feedback and session history.',
    url: 'https://flowen.digital',
    siteName: 'Flowen',
    images: [
      {
        url: '/assets/images/flowen-hero-banner.jpg',
        width: 1200,
        height: 630,
        alt: 'Flowen AI Speech Coordination Platform',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowen | Speech practice',
    description: 'Guided speech practice, live acoustic feedback and session history.',
    images: ['/assets/images/flowen-hero-banner.jpg'],
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.json',
};

async function getTrackingProviders(): Promise<TrackingProvider[]> {
  try {
    const { data } = await db()
      .from('tracking_providers')
      .select('provider_key, head_html, body_html, consent_required, enabled')
      .eq('enabled', true);
    return (data ?? []) as TrackingProvider[];
  } catch {
    return [];
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [trackingProviders, headersList] = await Promise.all([
    getTrackingProviders(),
    headers(),
  ]);
  // Nonce generated in src/proxy.ts and forwarded via x-nonce request header.
  // Applied to the FOUC script so CSP 'strict-dynamic' nonce allowlist matches.
  const nonce = headersList.get('x-nonce') ?? '';

  return (
    <html lang="en-GB" suppressHydrationWarning>
      {/* Anti-FOUC: runs synchronously before React paint — nonce required by CSP */}
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
        {/* Skip to main content — first focusable element for keyboard / screen-reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-emerald-500 focus:text-slate-950 focus:font-bold focus:text-sm focus:shadow-lg"
        >
          Skip to main content
        </a>
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          'name': 'Flowen',
          'url': 'https://flowen.digital',
          'logo': 'https://flowen.digital/icon.svg',
          'description': 'Browser-based speech practice platform operated by Flowen Speech Technologies Ltd.',
          'sameAs': [],
          'contactPoint': {
            '@type': 'ContactPoint',
            'contactType': 'customer support',
            'email': 'support@flowen.digital',
          },
        }} />
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          'name': 'Flowen',
          'applicationCategory': 'EducationalApplication',
          'operatingSystem': 'Web',
          'description': 'Browser-based speech practice with live acoustic feedback.',
          'url': 'https://flowen.digital',

        }} />
        <ThemeProvider>
          <PostHogProvider>
            {children}
          </PostHogProvider>
          <AnalyticsTracker />
          <CookieConsent />
          <TrackingScripts providers={trackingProviders} />
          <ImageLightbox />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
