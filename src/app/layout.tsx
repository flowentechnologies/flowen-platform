import type { Metadata } from 'next';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';
import TrackingScripts from '@/components/TrackingScripts';
import type { TrackingProvider } from '@/components/TrackingScripts';
import { JsonLd } from '@/components/JsonLd';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import PostHogProvider from '@/components/PostHogProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { adminDb as db } from '@/lib/supabase/admin';

// Inline script evaluated synchronously before first paint — prevents flash of
// unstyled (wrong-theme) content. Reads localStorage and applies the `dark`
// class to <html> before React hydrates so there is never a visible flicker.
const FOUC_SCRIPT = `(function(){try{var t=localStorage.getItem('flowen-theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: 'Flowen — Retraining the Brain to Speak Freely',
  description: 'AI Speech Coordination for School, Workplace & Daily Life. Sub-80ms real-time vocal retraining engine.',
  metadataBase: new URL('https://flowen.digital'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Flowen — AI Speech Coordination',
    description: 'Every word gets there. Sub-80ms real-time vocal retraining and clinical supervision platform.',
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
    title: 'Flowen — AI Speech Coordination',
    description: 'Every word gets there. Sub-150ms real-time vocal retraining.',
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
  const trackingProviders = await getTrackingProviders();

  return (
    <html lang="en" suppressHydrationWarning>
      {/* Anti-FOUC: runs synchronously before React paint */}
      <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
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
        </ThemeProvider>
      </body>
    </html>
  );
}
