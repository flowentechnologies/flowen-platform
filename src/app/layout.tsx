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
  title: 'Flowen — Real-time speech biofeedback for people who stammer',
  description: 'Practice speaking with instant acoustic biofeedback on your fluency. 3 free sessions, no card required. Built on evidence-based techniques used in clinical speech therapy.',
  metadataBase: new URL('https://flowen.digital'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Flowen — Real-time speech biofeedback',
    description: 'Instant feedback on your speech as you practise. 3 free sessions, no card required.',
    url: 'https://flowen.digital',
    siteName: 'Flowen',
    images: [
      {
        url: '/assets/images/flowen-hero-banner.jpg',
        width: 1200,
        height: 630,
        alt: 'Flowen real-time speech biofeedback platform',
      },
    ],
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowen — Real-time speech biofeedback',
    description: 'Instant feedback on your speech as you practise. 3 free sessions, no card required.',
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
          'description': 'Evidence-based AI speech fluency platform for people who stutter, powered by real-time vocal coordination technology.',
          'sameAs': [],
          'contactPoint': {
            '@type': 'ContactPoint',
            'contactType': 'customer support',
            'email': 'support@flowen.digital',
          },
        }} />
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          'name': 'Flowen',
          'url': 'https://flowen.digital',
          'potentialAction': {
            '@type': 'SearchAction',
            'target': {
              '@type': 'EntryPoint',
              'urlTemplate': 'https://flowen.digital/resources?q={search_term_string}',
            },
            'query-input': 'required name=search_term_string',
          },
        }} />
        <JsonLd data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          'name': 'Flowen',
          'applicationCategory': 'HealthApplication',
          'operatingSystem': 'Web, iOS, Android',
          'description': 'AI-powered real-time speech fluency training for people who stutter. Clinical supervision platform with 3D avatar feedback.',
          'url': 'https://flowen.digital',
          'offers': [
            {
              '@type': 'Offer',
              'name': 'Waitlist Standard',
              'price': '0',
              'priceCurrency': 'GBP',
              'description': 'Free baseline early access allocation without ongoing subscription commitments.',
            },
            {
              '@type': 'Offer',
              'name': 'Founding Member',
              'price': '19.96',
              'priceCurrency': 'GBP',
              'description': 'Founding member early access seat, price-locked with up to 50% discount on annual billing.',
            },
            {
              '@type': 'Offer',
              'name': 'Sponsored Entry',
              'price': '0',
              'priceCurrency': 'GBP',
              'description': 'Institutionally-sponsored access for eligible NHS, Access to Work, or DSA beneficiaries.',
            },
          ],
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
